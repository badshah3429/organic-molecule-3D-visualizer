// 3D Molecule Visualizer using Three.js + PubChem API

class MoleculeVisualizer {
    constructor() {
        this.container = document.getElementById('molecule-viewer');
        this.viewStyle = 'ball-stick';
        this.autoRotate = true;
        this.rotationSpeed = 3;
        this.currentMolecule = null;

        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.moleculeGroup = null;

        // Materials cache
        this.materials = {};
        this.bondMaterial = null;

        // Search debounce
        this.searchTimeout = null;

        this.init();
    }

    init() {
        this.setupThreeJS();
        this.createMaterials();
        this.setupEventListeners();
        this.hideLoading();
    }

    setupThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Camera
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 5);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Orbit Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.autoRotate = this.autoRotate;
        this.controls.autoRotateSpeed = this.rotationSpeed;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 10, 7);
        mainLight.castShadow = true;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x88ccff, 0.3);
        fillLight.position.set(-5, -5, -5);
        this.scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xffffcc, 0.2);
        rimLight.position.set(0, -10, 5);
        this.scene.add(rimLight);

        // Molecule group
        this.moleculeGroup = new THREE.Group();
        this.scene.add(this.moleculeGroup);

        // Event handlers
        window.addEventListener('resize', () => this.onWindowResize());
        this.renderer.domElement.addEventListener('dblclick', () => this.controls.reset());

        // Start animation loop
        this.animate();
    }

    createMaterials() {
        this.bondMaterial = new THREE.MeshPhongMaterial({
            color: 0x888888,
            specular: 0x444444,
            shininess: 20
        });
    }

    getMaterial(element) {
        if (!this.materials[element]) {
            const props = getAtomProperties(element);
            this.materials[element] = new THREE.MeshPhongMaterial({
                color: props.color,
                specular: 0x444444,
                shininess: 30
            });
        }
        return this.materials[element];
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('molecule-search');
        const searchBtn = document.getElementById('search-btn');
        const searchResults = document.getElementById('search-results');

        searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            const query = e.target.value.trim();

            if (query.length < 2) {
                searchResults.innerHTML = '';
                searchResults.classList.remove('visible');
                return;
            }

            this.searchTimeout = setTimeout(async () => {
                const suggestions = await pubchem.autocomplete(query);
                this.showSearchSuggestions(suggestions);
            }, 300);
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchResults.innerHTML = '';
                searchResults.classList.remove('visible');
                this.loadMolecule(searchInput.value.trim());
            }
        });

        searchBtn.addEventListener('click', () => {
            searchResults.innerHTML = '';
            searchResults.classList.remove('visible');
            this.loadMolecule(searchInput.value.trim());
        });

        // Click outside to close suggestions
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-section')) {
                searchResults.innerHTML = '';
                searchResults.classList.remove('visible');
            }
        });

        // Quick select dropdown
        document.getElementById('molecule-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadMolecule(e.target.value);
            }
        });

        // View style buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.viewStyle = e.target.dataset.view;
                if (this.currentMolecule) {
                    this.renderMolecule(this.currentMolecule);
                }
            });
        });

        // Auto-rotate
        document.getElementById('auto-rotate').addEventListener('change', (e) => {
            this.autoRotate = e.target.checked;
            this.controls.autoRotate = this.autoRotate;
        });

        // Rotation speed
        document.getElementById('rotation-speed').addEventListener('input', (e) => {
            this.rotationSpeed = parseInt(e.target.value);
            this.controls.autoRotateSpeed = this.rotationSpeed;
        });
    }

    showSearchSuggestions(suggestions) {
        const searchResults = document.getElementById('search-results');

        if (suggestions.length === 0) {
            searchResults.innerHTML = '';
            searchResults.classList.remove('visible');
            return;
        }

        searchResults.innerHTML = suggestions.map(name =>
            `<div class="search-result-item" data-name="${name}">${name}</div>`
        ).join('');
        searchResults.classList.add('visible');

        // Add click handlers
        searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('molecule-search').value = item.dataset.name;
                searchResults.innerHTML = '';
                searchResults.classList.remove('visible');
                this.loadMolecule(item.dataset.name);
            });
        });
    }

    async loadMolecule(nameOrCid) {
        if (!nameOrCid) return;

        this.showLoading();

        try {
            const molecule = await pubchem.getCompoundInfo(nameOrCid);
            this.currentMolecule = molecule;
            this.renderMolecule(molecule);
            this.updateInfoPanel(molecule);
        } catch (error) {
            console.error('Failed to load molecule:', error);
            this.showError(`Could not find "${nameOrCid}". Try a different name or check spelling.`);
        } finally {
            this.hideLoading();
        }
    }

    renderMolecule(molecule) {
        // Clear existing
        while (this.moleculeGroup.children.length > 0) {
            const child = this.moleculeGroup.children[0];
            if (child.geometry) child.geometry.dispose();
            this.moleculeGroup.remove(child);
        }


        if (!molecule.atoms || molecule.atoms.length === 0) {
            return;
        }

        // Create atoms
        molecule.atoms.forEach((atom, index) => {
            this.createAtom(atom, index);
        });

        // Create bonds (except for space-fill mode)
        if (this.viewStyle !== 'space-fill' && molecule.bonds) {
            molecule.bonds.forEach((bond) => {
                const atom1 = molecule.atoms[bond.from];
                const atom2 = molecule.atoms[bond.to];
                if (atom1 && atom2) {
                    this.createBond(atom1, atom2, bond.order);
                }
            });
        }

        this.centerMolecule();
    }

    createAtom(atom, index) {
        const props = getAtomProperties(atom.element);

        let radius;
        if (this.viewStyle === 'space-fill') {
            radius = props.vdwRadius;
        } else if (this.viewStyle === 'stick') {
            radius = 0.15;
        } else {
            // Ball-and-stick: bigger spheres
            radius = props.radius * 1.2;
        }

        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = this.getMaterial(atom.element);
        const sphere = new THREE.Mesh(geometry, material);

        sphere.position.set(atom.x, atom.y, atom.z);
        sphere.castShadow = true;
        sphere.receiveShadow = true;
        sphere.userData = { element: atom.element, index: index };

        this.moleculeGroup.add(sphere);
    }

    createBond(atom1, atom2, order) {
        const start = new THREE.Vector3(atom1.x, atom1.y, atom1.z);
        const end = new THREE.Vector3(atom2.x, atom2.y, atom2.z);

        const direction = new THREE.Vector3().subVectors(end, start);
        const length = direction.length();
        const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

        const bondRadius = this.viewStyle === 'stick' ? 0.1 : 0.08;
        const numBonds = Math.min(order, 3);
        const spacing = 0.15;

        let perpendicular = new THREE.Vector3(1, 0, 0);
        if (Math.abs(direction.x) > 0.9 * length) {
            perpendicular = new THREE.Vector3(0, 1, 0);
        }
        perpendicular.crossVectors(direction, perpendicular).normalize();

        for (let i = 0; i < numBonds; i++) {
            let offset = new THREE.Vector3();
            if (numBonds > 1) {
                const offsetAmount = (i - (numBonds - 1) / 2) * spacing;
                offset = perpendicular.clone().multiplyScalar(offsetAmount);
            }

            const geometry = new THREE.CylinderGeometry(bondRadius, bondRadius, length, 16);
            const cylinder = new THREE.Mesh(geometry, this.bondMaterial);

            cylinder.position.copy(center).add(offset);

            const axis = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, direction.clone().normalize());
            cylinder.quaternion.copy(quaternion);

            cylinder.castShadow = true;
            cylinder.receiveShadow = true;

            this.moleculeGroup.add(cylinder);
        }
    }

    centerMolecule() {
        const box = new THREE.Box3().setFromObject(this.moleculeGroup);
        const center = box.getCenter(new THREE.Vector3());

        this.moleculeGroup.children.forEach(child => {
            child.position.sub(center);
        });

        // Calculate optimal camera distance based on molecule size
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Use FOV to calculate proper distance
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = (maxDim / 2) / Math.tan(fov / 2) + maxDim * 0.5;

        this.camera.position.set(0, 0, Math.max(distance, 4));
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    drawLewisStructure(molecule) {
        const canvas = document.getElementById('lewis-canvas');
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!molecule.atoms || molecule.atoms.length === 0) return;

        // Valence electrons for common elements
        const valenceElectrons = {
            'H': 1, 'C': 4, 'N': 5, 'O': 6, 'F': 7, 'Cl': 7, 'Br': 7, 'I': 7,
            'S': 6, 'P': 5, 'B': 3, 'Si': 4
        };

        // Element colors
        const elementColors = {
            'C': '#888888', 'H': '#ffffff', 'O': '#ff4444', 'N': '#4444ff',
            'S': '#ffff00', 'P': '#ff8800', 'F': '#00ff00', 'Cl': '#00dd00',
            'Br': '#884400', 'I': '#6600bb'
        };

        // Build adjacency and count bonds per atom
        const neighbors = molecule.atoms.map(() => []);
        const bondOrders = molecule.atoms.map(() => ({})); // bondOrders[i][j] = order
        molecule.bonds.forEach(bond => {
            neighbors[bond.from].push(bond.to);
            neighbors[bond.to].push(bond.from);
            bondOrders[bond.from][bond.to] = bond.order;
            bondOrders[bond.to][bond.from] = bond.order;
        });

        // Calculate electron domains (bonds + lone pairs) for each atom
        const atomInfo = molecule.atoms.map((atom, i) => {
            const element = atom.element;
            const valence = valenceElectrons[element] || 4;
            const bondCount = neighbors[i].length;
            const bondedElectrons = neighbors[i].reduce((sum, j) => sum + (bondOrders[i][j] || 1), 0);
            const lonePairs = Math.max(0, Math.floor((valence - bondedElectrons) / 2));
            const totalDomains = bondCount + lonePairs;
            return { element, valence, bondCount, lonePairs, totalDomains };
        });

        // Compute positions using BFS from a central atom, placing bonds at optimal angles
        const positions = this.computeLewisPositions(molecule, neighbors, atomInfo);

        // Now compute the actual angles each bond makes from each atom's perspective
        const bondAngles = molecule.atoms.map(() => []);
        molecule.bonds.forEach(bond => {
            const p1 = positions[bond.from];
            const p2 = positions[bond.to];
            bondAngles[bond.from].push(Math.atan2(p2.y - p1.y, p2.x - p1.x));
            bondAngles[bond.to].push(Math.atan2(p1.y - p2.y, p1.x - p2.x));
        });

        // Draw bonds
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#aaaaaa';
        molecule.bonds.forEach(bond => {
            const p1 = positions[bond.from];
            const p2 = positions[bond.to];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / len * 3;
            const perpY = dx / len * 3;

            const order = Math.min(bond.order, 3);
            for (let i = 0; i < order; i++) {
                const offset = (i - (order - 1) / 2);
                ctx.beginPath();
                ctx.moveTo(p1.x + perpX * offset, p1.y + perpY * offset);
                ctx.lineTo(p2.x + perpX * offset, p2.y + perpY * offset);
                ctx.stroke();
            }
        });

        // Draw atoms and lone pairs
        molecule.atoms.forEach((atom, index) => {
            const p = positions[index];
            const info = atomInfo[index];
            const element = info.element;

            // Draw lone pairs at positions not occupied by bonds
            if (info.lonePairs > 0 && element !== 'C' && element !== 'H') {
                ctx.fillStyle = elementColors[element] || '#ffffff';
                const dotRadius = 2;
                const dotDistance = 14;

                // Get optimal angles for all domains (bonds + lone pairs)
                const totalDomains = info.totalDomains;
                const optimalAngles = this.getOptimalAngles(totalDomains);

                // Find which optimal angles are used by bonds
                const usedAngles = bondAngles[index].slice();

                // Find unused angles for lone pairs
                const unusedAngles = optimalAngles.filter(optAngle => {
                    return !usedAngles.some(usedAngle => {
                        let diff = Math.abs(optAngle - usedAngle);
                        if (diff > Math.PI) diff = 2 * Math.PI - diff;
                        return diff < Math.PI / 4;
                    });
                });

                // Draw lone pairs
                for (let i = 0; i < Math.min(info.lonePairs, unusedAngles.length); i++) {
                    const angle = unusedAngles[i];
                    const dx = Math.cos(angle) * dotDistance;
                    const dy = Math.sin(angle) * dotDistance;
                    const perpX = -Math.sin(angle) * 3;
                    const perpY = Math.cos(angle) * 3;

                    ctx.beginPath();
                    ctx.arc(p.x + dx + perpX, p.y + dy + perpY, dotRadius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.arc(p.x + dx - perpX, p.y + dy - perpY, dotRadius, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Draw element symbol with background circle
            ctx.fillStyle = '#1a1a2e';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = elementColors[element] || '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(element, p.x, p.y);
        });
    }

    // Get optimal angles for n electron domains (evenly distributed)
    getOptimalAngles(n) {
        if (n <= 0) return [];
        const angles = [];
        const startAngle = -Math.PI / 2; // Start from top
        for (let i = 0; i < n; i++) {
            angles.push(startAngle + (2 * Math.PI * i) / n);
        }
        return angles;
    }

    // Check if molecule has rings (cycles) using DFS
    hasRings(neighbors) {
        const n = neighbors.length;
        const visited = new Array(n).fill(false);
        const parent = new Array(n).fill(-1);

        const dfs = (current) => {
            visited[current] = true;
            for (const neighbor of neighbors[current]) {
                if (!visited[neighbor]) {
                    parent[neighbor] = current;
                    if (dfs(neighbor)) return true;
                } else if (neighbor !== parent[current]) {
                    return true; // Found a cycle
                }
            }
            return false;
        };

        for (let i = 0; i < n; i++) {
            if (!visited[i] && dfs(i)) return true;
        }
        return false;
    }

    // Compute 2D positions for Lewis structure
    // Uses PubChem's 2D coordinates when available, otherwise VSEPR-style angles
    computeLewisPositions(molecule, neighbors, atomInfo) {
        const canvas = document.getElementById('lewis-canvas');
        const padding = 25;
        const minBondLength = 25; // Minimum bond length in final canvas coordinates

        let positions;

        // Use PubChem's 2D coordinates directly - they're already optimized for display
        if (molecule.atoms2D && molecule.atoms2D.length === molecule.atoms.length) {
            positions = molecule.atoms2D.map(atom => ({
                x: atom.x,
                y: -atom.y  // Flip Y axis (PubChem uses inverted Y)
            }));
        } else {
            // Fallback to VSEPR-style placement
            positions = this.computeVSEPRPositions(molecule, neighbors, atomInfo);
        }

        // Center and scale to fit canvas
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        positions.forEach(p => {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        });

        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const scaleX = (canvas.width - padding * 2) / rangeX;
        const scaleY = (canvas.height - padding * 2) / rangeY;
        const scale = Math.min(scaleX, scaleY);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;

        return positions.map(p => ({
            x: centerX + (p.x - midX) * scale,
            y: centerY + (p.y - midY) * scale
        }));
    }

    // VSEPR-style placement for acyclic molecules
    computeVSEPRPositions(molecule, neighbors, atomInfo) {
        const bondLength = 35;

        // Find a good starting atom (most connections, non-hydrogen)
        let startAtom = 0;
        let maxConnections = -1;
        molecule.atoms.forEach((atom, i) => {
            if (atom.element !== 'H' && neighbors[i].length > maxConnections) {
                maxConnections = neighbors[i].length;
                startAtom = i;
            }
        });

        const positions = new Array(molecule.atoms.length).fill(null);
        positions[startAtom] = { x: 0, y: 0 };

        const visited = new Set([startAtom]);
        const queue = [startAtom];

        while (queue.length > 0) {
            const current = queue.shift();
            const currentPos = positions[current];
            const currentNeighbors = neighbors[current];

            // Get optimal angles for this atom's bonds
            const numDomains = atomInfo[current].totalDomains;
            const optimalAngles = this.getOptimalAngles(Math.max(numDomains, currentNeighbors.length));

            // Find which angles are already used (by placed neighbors)
            const usedOptimalIndices = new Set();
            const unplacedNeighbors = currentNeighbors.filter(n => !visited.has(n));
            const placedNeighbors = currentNeighbors.filter(n => visited.has(n));

            // First, account for already placed neighbors
            placedNeighbors.forEach(n => {
                const nPos = positions[n];
                const actualAngle = Math.atan2(nPos.y - currentPos.y, nPos.x - currentPos.x);

                // Find closest optimal angle
                let bestIdx = 0;
                let bestDiff = Infinity;
                optimalAngles.forEach((opt, idx) => {
                    if (usedOptimalIndices.has(idx)) return;
                    let diff = Math.abs(opt - actualAngle);
                    if (diff > Math.PI) diff = 2 * Math.PI - diff;
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestIdx = idx;
                    }
                });
                usedOptimalIndices.add(bestIdx);
            });

            // Place unplaced neighbors at remaining optimal angles
            let angleIdx = 0;
            unplacedNeighbors.forEach(neighbor => {
                while (usedOptimalIndices.has(angleIdx) && angleIdx < optimalAngles.length) {
                    angleIdx++;
                }

                if (angleIdx < optimalAngles.length) {
                    const angle = optimalAngles[angleIdx];
                    usedOptimalIndices.add(angleIdx);

                    positions[neighbor] = {
                        x: currentPos.x + Math.cos(angle) * bondLength,
                        y: currentPos.y + Math.sin(angle) * bondLength
                    };
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
                angleIdx++;
            });
        }

        // Handle any disconnected atoms
        positions.forEach((p, i) => {
            if (p === null) {
                positions[i] = { x: 0, y: 0 };
            }
        });

        return positions;
    }

    updateInfoPanel(molecule) {
        document.getElementById('molecule-name').textContent = molecule.name || 'Unknown';
        document.getElementById('molecule-formula').textContent = molecule.formula || '';
        document.getElementById('molecule-weight').textContent = molecule.weight ?
            `MW: ${parseFloat(molecule.weight).toFixed(2)} g/mol` : '';

        // Draw Lewis structure
        this.drawLewisStructure(molecule);

        // Build info text with description
        const infoLines = [];

        if (molecule.description) {
            infoLines.push(molecule.description);
        }

        if (molecule.iupacName && molecule.iupacName !== molecule.name) {
            infoLines.push('');
            infoLines.push(`IUPAC: ${molecule.iupacName}`);
        }

        if (molecule.is2D) {
            infoLines.push('');
            infoLines.push('(2D structure - 3D not available)');
        }

        document.getElementById('molecule-info').textContent = infoLines.join('\n');

        // Properties grid
        const propsEl = document.getElementById('molecule-properties');
        const props = [];

        // Structure counts
        props.push({ label: 'Atoms', value: molecule.atoms.length });
        props.push({ label: 'Bonds', value: molecule.bonds.length });

        // Formal charge
        if (molecule.charge !== undefined && molecule.charge !== 0) {
            const chargeStr = molecule.charge > 0 ? `+${molecule.charge}` : molecule.charge;
            const chargeClass = molecule.charge > 0 ? 'charge-positive' : 'charge-negative';
            props.push({ label: 'Charge', value: chargeStr, class: chargeClass });
        }

        // Exact mass
        if (molecule.exactMass) {
            props.push({ label: 'Exact Mass', value: parseFloat(molecule.exactMass).toFixed(4) });
        }

        // LogP (lipophilicity) - important for drug-likeness
        if (molecule.xlogp !== undefined) {
            props.push({ label: 'LogP', value: molecule.xlogp.toFixed(2), title: 'Octanol-water partition coefficient (lipophilicity)' });
        }

        // TPSA - polar surface area
        if (molecule.tpsa !== undefined) {
            props.push({ label: 'TPSA', value: `${molecule.tpsa.toFixed(1)} Å²`, title: 'Topological Polar Surface Area' });
        }

        // H-bond donors/acceptors
        if (molecule.hbondDonors !== undefined) {
            props.push({ label: 'H-Donors', value: molecule.hbondDonors, title: 'Hydrogen bond donors' });
        }
        if (molecule.hbondAcceptors !== undefined) {
            props.push({ label: 'H-Acceptors', value: molecule.hbondAcceptors, title: 'Hydrogen bond acceptors' });
        }

        // Rotatable bonds
        if (molecule.rotatableBonds !== undefined) {
            props.push({ label: 'Rotatable', value: molecule.rotatableBonds, title: 'Rotatable bonds (flexibility)' });
        }

        // Complexity
        if (molecule.complexity !== undefined) {
            props.push({ label: 'Complexity', value: Math.round(molecule.complexity), title: 'Molecular complexity score' });
        }

        propsEl.innerHTML = props.map(p =>
            `<div class="prop-item" ${p.title ? `title="${p.title}"` : ''}>
                <span class="prop-label">${p.label}</span>
                <span class="prop-value ${p.class || ''}">${p.value}</span>
            </div>`
        ).join('');

        // SMILES
        const smilesEl = document.getElementById('molecule-smiles');
        if (molecule.smiles) {
            smilesEl.innerHTML = `
                <div class="smiles-label">SMILES</div>
                <div class="smiles-value" title="Click to copy">${molecule.smiles}</div>
            `;
            // Copy on click
            smilesEl.querySelector('.smiles-value').addEventListener('click', () => {
                navigator.clipboard.writeText(molecule.smiles);
            });
        } else {
            smilesEl.innerHTML = '';
        }

        // PubChem link
        const linksEl = document.getElementById('molecule-links');
        if (molecule.cid) {
            linksEl.innerHTML = `<a href="${molecule.pubchemUrl}" target="_blank" rel="noopener">View on PubChem →</a>`;
        } else {
            linksEl.innerHTML = '';
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('molecule-name').textContent = 'Error';
        document.getElementById('molecule-formula').textContent = '';
        document.getElementById('molecule-weight').textContent = '';
        document.getElementById('molecule-info').textContent = message;
        document.getElementById('molecule-links').innerHTML = '';
    }

    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MoleculeVisualizer();
});
