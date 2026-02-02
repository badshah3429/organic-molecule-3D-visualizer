// PubChem API Integration
// Fetches 3D molecular structures from PubChem's database of 100+ million compounds

class PubChemAPI {
    constructor() {
        this.baseUrl = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
        this.viewUrl = 'https://pubchem.ncbi.nlm.nih.gov/compound';
    }

    // Search for compounds by name
    async searchByName(query, maxResults = 10) {
        try {
            const url = `${this.baseUrl}/compound/name/${encodeURIComponent(query)}/cids/JSON`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Compound not found');
            }

            const data = await response.json();
            const cids = data.IdentifierList.CID.slice(0, maxResults);

            // Get properties for each CID
            return await this.getCompoundProperties(cids);
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }

    // Autocomplete search
    async autocomplete(query, maxResults = 8) {
        try {
            const url = `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(query)}/json?limit=${maxResults}`;
            const response = await fetch(url);

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            return data.dictionary_terms?.compound || [];
        } catch (error) {
            console.error('Autocomplete error:', error);
            return [];
        }
    }

    // Get compound properties
    async getCompoundProperties(cids) {
        try {
            const cidList = Array.isArray(cids) ? cids.join(',') : cids;
            // Request many useful ochem properties
            const properties = [
                'MolecularFormula',
                'MolecularWeight',
                'IUPACName',
                'Title',
                'Charge',                    // Formal charge
                'XLogP',                     // Lipophilicity (octanol-water partition)
                'TPSA',                      // Topological polar surface area
                'HBondDonorCount',           // H-bond donors
                'HBondAcceptorCount',        // H-bond acceptors
                'RotatableBondCount',        // Rotatable bonds
                'Complexity',                // Molecular complexity score
                'IsomericSMILES',            // SMILES with stereochemistry
                'InChI',                     // IUPAC International Chemical Identifier
                'ExactMass',                 // Exact monoisotopic mass
            ].join(',');

            const url = `${this.baseUrl}/compound/cid/${cidList}/property/${properties}/JSON`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to fetch properties');
            }

            const data = await response.json();
            return data.PropertyTable.Properties;
        } catch (error) {
            console.error('Properties error:', error);
            return [];
        }
    }

    // Get 3D structure in SDF format
    async get3DStructure(cid) {
        try {
            // Try to get 3D conformer first
            const url = `${this.baseUrl}/compound/cid/${cid}/record/SDF/?record_type=3d&response_type=display`;
            const response = await fetch(url);

            if (!response.ok) {
                // Fall back to 2D if 3D not available
                console.warn('3D structure not available, trying 2D...');
                return await this.get2DStructure(cid);
            }

            const sdfData = await response.text();
            return this.parseSDF(sdfData);
        } catch (error) {
            console.error('3D structure error:', error);
            throw error;
        }
    }

    // Get 2D structure as fallback
    async get2DStructure(cid) {
        try {
            const url = `${this.baseUrl}/compound/cid/${cid}/record/SDF/?response_type=display`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Structure not available');
            }

            const sdfData = await response.text();
            return this.parseSDF(sdfData, true);
        } catch (error) {
            console.error('2D structure error:', error);
            throw error;
        }
    }

    // Parse SDF/MOL format to extract atoms and bonds
    parseSDF(sdfData, is2D = false) {
        const lines = sdfData.split('\n');
        const atoms = [];
        const bonds = [];

        // Find the counts line (line 4, index 3)
        // Format: aaabbblllfffcccsssxxxrrrpppiiimmmvvvvvv
        // aaa = number of atoms, bbb = number of bonds
        let countsLineIndex = 3;
        const countsLine = lines[countsLineIndex];
        const atomCount = parseInt(countsLine.substring(0, 3).trim());
        const bondCount = parseInt(countsLine.substring(3, 6).trim());

        // Parse atoms (start at line 5, index 4)
        for (let i = 0; i < atomCount; i++) {
            const line = lines[countsLineIndex + 1 + i];
            if (!line) continue;

            // SDF atom line format:
            // xxxxx.xxxxyyyyy.yyyyzzzzz.zzzz aaaddcccssshhhbbbvvvHHHrrriiimmmnnneee
            const x = parseFloat(line.substring(0, 10).trim());
            const y = parseFloat(line.substring(10, 20).trim());
            const z = parseFloat(line.substring(20, 30).trim());
            const element = line.substring(31, 34).trim();

            atoms.push({
                element: element,
                x: x,
                y: y,
                z: is2D ? 0 : z
            });
        }

        // Parse bonds
        const bondStartIndex = countsLineIndex + 1 + atomCount;
        for (let i = 0; i < bondCount; i++) {
            const line = lines[bondStartIndex + i];
            if (!line) continue;

            // SDF bond line format:
            // 111222tttsssxxxrrrccc
            const atom1 = parseInt(line.substring(0, 3).trim()) - 1; // 1-indexed in SDF
            const atom2 = parseInt(line.substring(3, 6).trim()) - 1;
            const order = parseInt(line.substring(6, 9).trim());

            bonds.push({
                from: atom1,
                to: atom2,
                order: order
            });
        }

        return { atoms, bonds, is2D };
    }

    // Get compound description/summary
    async getDescription(cid) {
        try {
            const url = `${this.baseUrl}/compound/cid/${cid}/description/JSON`;
            const response = await fetch(url);

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            const descriptions = data.InformationList?.Information || [];

            // Find a good description (prefer shorter, informative ones)
            for (const info of descriptions) {
                if (info.Description) {
                    // Clean up and truncate if needed
                    let desc = info.Description;
                    // Take first 2-3 sentences
                    const sentences = desc.match(/[^.!?]+[.!?]+/g) || [desc];
                    desc = sentences.slice(0, 3).join(' ').trim();
                    if (desc.length > 300) {
                        desc = desc.substring(0, 297) + '...';
                    }
                    return desc;
                }
            }
            return null;
        } catch (error) {
            console.error('Description error:', error);
            return null;
        }
    }

    // Get full compound info
    async getCompoundInfo(nameOrCid) {
        try {
            let cid;

            // Check if it's a CID or name
            if (typeof nameOrCid === 'number' || /^\d+$/.test(nameOrCid)) {
                cid = nameOrCid;
            } else {
                // Search by name to get CID
                const url = `${this.baseUrl}/compound/name/${encodeURIComponent(nameOrCid)}/cids/JSON`;
                const response = await fetch(url);

                if (!response.ok) {
                    throw new Error('Compound not found');
                }

                const data = await response.json();
                cid = data.IdentifierList.CID[0];
            }

            // Get properties, 3D structure, 2D structure, and description in parallel
            const [properties, structure3D, structure2D, description] = await Promise.all([
                this.getCompoundProperties(cid),
                this.get3DStructure(cid),
                this.get2DStructure(cid),
                this.getDescription(cid)
            ]);

            const props = properties[0] || {};

            return {
                cid: cid,
                name: props.Title || props.IUPACName || nameOrCid,
                iupacName: props.IUPACName,
                formula: props.MolecularFormula,
                weight: props.MolecularWeight,
                exactMass: props.ExactMass,
                description: description,
                // Chemistry properties
                charge: props.Charge,                    // Formal charge
                xlogp: props.XLogP,                      // Lipophilicity
                tpsa: props.TPSA,                        // Polar surface area (Å²)
                hbondDonors: props.HBondDonorCount,      // H-bond donors
                hbondAcceptors: props.HBondAcceptorCount, // H-bond acceptors
                rotatableBonds: props.RotatableBondCount,
                complexity: props.Complexity,
                smiles: props.IsomericSMILES,
                inchi: props.InChI,
                // 3D Structure (for WebGL viewer)
                atoms: structure3D.atoms,
                bonds: structure3D.bonds,
                is2D: structure3D.is2D,
                // 2D Structure (for Lewis diagram)
                atoms2D: structure2D.atoms,
                pubchemUrl: `${this.viewUrl}/${cid}`
            };
        } catch (error) {
            console.error('GetCompoundInfo error:', error);
            throw error;
        }
    }
}

// Atom properties for visualization (CPK coloring scheme)
const ATOM_PROPERTIES = {
    C: { name: 'Carbon', color: 0x404040, radius: 0.35, vdwRadius: 0.77 },
    H: { name: 'Hydrogen', color: 0xffffff, radius: 0.20, vdwRadius: 0.53 },
    O: { name: 'Oxygen', color: 0xff2222, radius: 0.32, vdwRadius: 0.60 },
    N: { name: 'Nitrogen', color: 0x3333ff, radius: 0.32, vdwRadius: 0.56 },
    S: { name: 'Sulfur', color: 0xffff00, radius: 0.35, vdwRadius: 1.02 },
    P: { name: 'Phosphorus', color: 0xff8800, radius: 0.35, vdwRadius: 1.06 },
    F: { name: 'Fluorine', color: 0x00ff00, radius: 0.28, vdwRadius: 0.47 },
    Cl: { name: 'Chlorine', color: 0x00ff00, radius: 0.32, vdwRadius: 0.79 },
    Br: { name: 'Bromine', color: 0x882200, radius: 0.35, vdwRadius: 0.94 },
    I: { name: 'Iodine', color: 0x6600bb, radius: 0.38, vdwRadius: 1.15 },
    // Metals and other common elements
    Na: { name: 'Sodium', color: 0x0000ff, radius: 0.40, vdwRadius: 1.54 },
    K: { name: 'Potassium', color: 0x0000ff, radius: 0.45, vdwRadius: 1.96 },
    Ca: { name: 'Calcium', color: 0x808080, radius: 0.40, vdwRadius: 1.74 },
    Mg: { name: 'Magnesium', color: 0x00aa00, radius: 0.35, vdwRadius: 1.36 },
    Fe: { name: 'Iron', color: 0xdd7700, radius: 0.35, vdwRadius: 1.17 },
    Zn: { name: 'Zinc', color: 0x7d80b0, radius: 0.35, vdwRadius: 1.25 },
    Cu: { name: 'Copper', color: 0xc88033, radius: 0.35, vdwRadius: 1.17 },
    // Default for unknown elements
    default: { name: 'Unknown', color: 0xff00ff, radius: 0.30, vdwRadius: 0.80 }
};

// Get properties for an element
function getAtomProperties(element) {
    return ATOM_PROPERTIES[element] || ATOM_PROPERTIES.default;
}

// Global API instance
const pubchem = new PubChemAPI();
