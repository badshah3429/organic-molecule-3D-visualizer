# Its Badshah

Interactive 3D molecular structure visualizer for organic chemistry education, powered by PubChem and Three.js.

**Live Demo:** [ochem-visualizer.vercel.app](https://ochem-visualizer.vercel.app/)

## Features

- **3D Molecular Visualization** - Interactive ball-and-stick, space-fill, and stick rendering modes
- **PubChem Integration** - Search millions of compounds from the PubChem database
- **2D Lewis Structures** - Automatic generation with lone pairs and bond visualization
- **Molecular Properties** - Formula, weight, LogP, TPSA, hydrogen bond donors/acceptors, SMILES, and more
- **Interactive Controls** - Drag to rotate, scroll to zoom, auto-rotation with adjustable speed
- **CPK Color Scheme** - Standard atom coloring used in chemistry visualization

## Tech Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **3D Rendering:** [Three.js](https://threejs.org/) with OrbitControls
- **Data Source:** [PubChem REST API](https://pubchem.ncbi.nlm.nih.gov/)
- **Deployment:** Vercel

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ochem-visualizer.git
   cd ochem-visualizer
   ```

2. Open `index.html` in a browser, or serve with any static file server:
   ```bash
   # Using Python
   python -m http.server 8000

   # Using Node.js
   npx serve
   ```

3. Visit `http://localhost:8000`

## Usage

- **Search** - Type any molecule name (e.g., "caffeine", "aspirin", "glucose") and press Enter
- **Quick Select** - Choose from common molecules in the dropdown menu
- **View Modes** - Switch between Ball & Stick, Space Fill, and Stick views
- **Rotation** - Toggle auto-rotation and adjust speed with the slider
- **Interact** - Drag to rotate, scroll to zoom, double-click to reset view

## Project Structure

```
ochem-visualizer/
├── index.html      # Main HTML with controls and layout
├── app.js          # MoleculeVisualizer class - 3D rendering logic
├── pubchem.js      # PubChem API integration and SDF parsing
├── styles.css      # Styling and responsive design
├── og-image.svg    # Open Graph preview image
├── robots.txt      # Search engine directives
└── sitemap.xml     # Site structure for SEO

## Acknowledgments

- [PubChem](https://pubchem.ncbi.nlm.nih.gov/) for providing molecular data
- [Three.js](https://threejs.org/) for 3D rendering capabilities

