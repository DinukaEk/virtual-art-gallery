# 🎨 Virtual Art Gallery (3D Web Experience)

A fully interactive **3D virtual art gallery** built with **Three.js**, allowing visitors to walk through a digitally-rendered museum, view paintings, explore multiple rooms, and observe 3D statues placed on pedestals.

🔗 **Live Demo (GitHub Pages)**  
https://dinukaek.github.io/virtual-art-gallery/

---

## ✨ Features

### 🖼️ Dynamic Artwork System
- Automatically places paintings across all gallery wall segments.
- Smart collision detection ensures:
  - No overlapping paintings  
  - No artwork placed too close to corners  
  - Paintings never extend into doorways  
- Supports large galleries (tested with 100+ paintings).

### 🏛️ Multi-Room Gallery Layout
- Atrium + North, East, and West wings.
- Internal divider walls for a realistic museum pathway.
- Navigation-friendly open floor plan.

### 🚶 First-Person Navigation
- **W A S D** for movement  
- **Mouse look** for viewing  
- Smooth velocity system & collision-based bounds  
- Pointer-lock controls with overlay

### 🗿 3D Statue Placement
- Imported OBJ/MTL statue models
- Automatically placed at the center of each gallery section
- Statues stand upright with corrected orientation  
- Random small Y-axis rotation for realism

### 🧱 Materials & Textures
- PBR-ish wall and floor materials  
- Marble floor tiles  
- Soft lighting using Ambient + Hemisphere + Directional light  
- Subtle fog for depth

### 🌐 Deployed Using GitHub Pages
- Automated GitHub Actions workflow  
- `vite.config.ts` configured for proper base path

---

## 🖥️ Technologies Used

| Tech | Purpose |
|------|---------|
| **Three.js (0.180.0)** | Rendering 3D gallery |
| **Vite** | Fast development + production build |
| **TypeScript** | Type-safe development |
| **Troika Three Text** | Crisp text rendering for painting labels |
| **OBJLoader + MTLLoader** | Loading 3D statue models |
| **GitHub Pages + GitHub Actions** | Deployment |

---

## 📁 Project Structure

```bash
virtual-art-gallery/
│
├── public/
│ ├── textures/ # floors, walls, decor textures
│ ├── statues/ # .obj / .mtl / textures
│ ├── images/ # painting images
│ └── favicon.svg
│
├── src/
│ ├── main.ts # app entry, renderer, controls
│ ├── gallery.ts # builds rooms, walls, paintings, statues
│ ├── frame.ts # painting frame mesh + label text
│ ├── movement.ts # first-person movement system
│ ├── loaders.ts # OBJ/MTL statue loader
│ └── types.ts # type definitions
│
├── index.html
├── vite.config.ts
└── package.json
```

---

## 🚀 Running Locally

### **1. Clone the repository**
```bash
git clone https://github.com/DinukaEk/virtual-art-gallery.git
cd virtual-art-gallery
```

### **2. Install dependencies**
```bash
npm install
```

### **3. Start development server**
```bash
npm run dev
```

### **4. Build for production**
```bash
npm run build
```
---

### 🌍 Deploying to GitHub Pages (Already Configured)

This project includes a working deployment workflow:

```bash
.github/workflows/deploy.yml
```

To deploy:
- Push changes to main
- GitHub Actions will build + publish automatically

---

### 🏺 Credits & Assets

**Statues**
- 3D models (OBJ/MTL) provided manually
- Licensed for educational / demonstrative use

**Painting Artworks**
- Used for demonstration purposes only
- All rights belong to their respective owners

**Textures**
- Floor & wall textures from Virtual Art Gallery reference project
- Additional PBR textures from royalty-free sources

---

### 📜 License

This project is for educational use.
You may expand or modify it freely.
(You may add MIT License or school-required license here.)

---

### 🙌 Acknowledgments

Special thanks to:
- Three.js community
- Troika Text library developers
- Original virtual art gallery layout inspiration