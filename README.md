# Claude Vectorization & SVG Animator

An advanced multimodal vector synthesis engine that converts raster images into interactive, hand-drawn quality animated SVGs using Vision-Language Models (Anthropic Claude 5.5/4.5, Google Gemini, OpenAI, and Local/Ollama models), paired with hierarchical scene decomposition, procedural SMIL animations, and publication-grade forensic telemetry reporting.

---

## 🌟 Key Architecture & Capabilities

### 1. Hierarchical Scene Decomposition & Stitched Assembly
Solves single-shot VLM character degradation by breaking complex raster images into semantic z-ordered layers:
- **Global Scene Planning**: Analyzes scene motifs, boundaries, and perspective to produce a multi-layer JSON blueprint with calculated viewBox.
- **Dedicated Layer Token Budgets**: Each semantic layer (Background, Character/Subject, Companion/Prop, Foreground/Effects) receives focused token attention and isolated visual reasoning.
- **Dynamic Z-Order Stitching**: Assembles vector fragments into a unified, layered SVG canvas with individual layer toggle and single-layer re-synthesis controls.

### 2. Pure SMIL Vector Animations
- **Zero-Dependency Portability**: Uses XML-native `<animate>`, `<animateTransform>`, and `<animateMotion>` tags that run in standalone browser tabs, `<img>` tags, and vector design suites without external JS or CSS.
- **Centroid Origin Geometry**: Dynamically parses the SVG `viewBox` (`cx = minX + width / 2`, `cy = minY + height / 2`) to ensure concentric in-place rotational and scaling transforms.
- **Procedural Preset Swapping**: Seamlessly applies Spin, Float, Pulse, Bounce, Wiggle, and Showcase presets client-side.

### 3. Forensic Telemetry & 8-Page Publication PDF Report Engine
Whenever an SVG is generated, the telemetry engine records granular execution metrics and generates a publication-grade **8-page PDF dossier (`report.pdf`)**:
- **Page 1: Official Deliverables Catalog & Hero Plate**: High-res hero render, deliverable asset index, and checksum specifications.
- **Page 2: Executive Process Summary & Technical Audit Matrix**: Pipeline narrative, vector precision, color depth, frame rate, and fidelity specs.
- **Page 3: Primary Master Plate**: 4K SVG master color render.
- **Page 4: Method 1 (Algorithmic Spline Vectorization)**: Bézier spline path breakdown.
- **Page 5: Method 2 (Crisp Comic Inks - White BG)**: High-contrast ink plate on pure white background.
- **Page 6: Method 2 (Crisp Comic Inks - Transparent Alpha)**: 32-bit RGBA ink plate for transparent overlays.
- **Page 7: Method 3 (Traditional Blue-Line Tracing Guide)**: Non-photo blue (`#5AB3E8`) drafting guide with 22% tonal underlay for redraw artists.
- **Page 8: Forensic Quality Control & Token Audit**: Tabular iteration-by-iteration token accounting (input, output, cached, thinking, net USD cost) and forensic QC proofs.

---

## 🛠️ Supported Model Providers

- **Anthropic Claude**: `claude-sonnet-5-5`, `claude-opus-5-5`, `claude-3-7-sonnet`, `claude-3-5-sonnet` (Native resolution, high-precision Béziers, unconstrained output tokens).
- **Google Gemini**: `gemini-2.5-flash`, `gemini-2.5-pro`.
- **OpenAI**: `gpt-4o`, `gpt-4o-mini`.
- **Local / Self-Hosted**: `qwen2.5-vl:72b`, `llama3.2-vision` via Ollama or vLLM.

---

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+) or Node.js (v18+)

### 1. Installation
```bash
git clone <repo-url>
cd claude-vectorization
bun install
# or: npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env.local` and add your API key(s):
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
ANTHROPIC_API_KEY="your-anthropic-api-key"
# Optional:
GEMINI_API_KEY="your-gemini-api-key"
OPENAI_API_KEY="your-openai-api-key"
```
*(You can also configure API keys dynamically in the UI settings drawer without editing files).*

### 3. Run Development Server
```bash
bun dev
# or: npm run dev
```
Open `http://localhost:3000` in your browser.

### 4. Build for Production
```bash
bun run build
# or: npm run build
```

---

## 📚 Technical Reference
- [ARCHITECTURE.md](ARCHITECTURE.md): Complete breakdown of vision decomposition, SMIL centroid mathematics, and payload contracts.
- [TOKEN_OPTIMIZATION.md](TOKEN_OPTIMIZATION.md): Telemetry tracking, cost optimization strategies, and prompt engineering protocols.
