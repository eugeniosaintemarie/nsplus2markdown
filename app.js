const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const pickFileButton = document.getElementById("pick-file-button");
const statusRow = document.getElementById("status-row");
const statusText = document.getElementById("status");
const fileMeta = document.getElementById("file-meta");
const previewEmpty = document.getElementById("preview-empty");
const previewEmptyMessage = document.getElementById("preview-empty-message");
const previewFrame = document.getElementById("preview-frame");
const workspaceContainer = document.getElementById("workspace-container");
const dropCardSection = document.getElementById("drop-card-section");
const previewPanelSection = document.getElementById("preview-panel-section");

let dragDepth = 0;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(message, tone = "idle") {
  if (statusText) {
    statusText.textContent = message;
  }

  if (statusRow) {
    statusRow.dataset.tone = tone;
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Tamaño desconocido";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function openFilePicker() {
  fileInput.click();
}

function showPreviewEmpty(message = "Elegí o arrastrá un archivo .nsplus para verlo convertido a markdown.") {
  if (previewEmptyMessage) {
    previewEmptyMessage.textContent = message;
  }

  if (previewEmpty) {
    previewEmpty.hidden = false;
  }

  if (previewFrame) {
    previewFrame.hidden = true;
  }

  // Mantener la vista en el input de archivo
  if (workspaceContainer) {
    workspaceContainer.dataset.state = "empty";
  }
  if (dropCardSection) {
    dropCardSection.hidden = false;
  }
  if (previewPanelSection) {
    previewPanelSection.hidden = true;
  }
}

function showPreviewContent(viewerHtml, fileName) {
  if (previewFrame) {
    previewFrame.srcdoc = viewerHtml;
    previewFrame.title = `Vista previa de ${fileName}`;
    previewFrame.hidden = false;
  }

  if (previewEmpty) {
    previewEmpty.hidden = true;
  }

  // Cambiar la vista para mostrar solo el panel de vista previa
  if (workspaceContainer) {
    workspaceContainer.dataset.state = "preview";
  }
  if (dropCardSection) {
    dropCardSection.hidden = true;
  }
  if (previewPanelSection) {
    previewPanelSection.hidden = false;
  }
}

function extractInputValues(codeHtml) {
  const template = document.createElement("template");
  template.innerHTML = codeHtml;
  return Array.from(template.content.querySelectorAll("input"), (input) => input.value ?? "");
}

function formatDiagramCode(codeHtml) {
  const values = extractInputValues(codeHtml);

  if (!values.length) {
    return "";
  }

  let javaCode = values.join(" ");
  javaCode = javaCode.replace(/ class :/g, ":");
  javaCode = javaCode.replace(/ \( /g, "(");
  javaCode = javaCode.replace(/ \)/g, ")");
  javaCode = javaCode.replace(/ ← /g, " = ");
  javaCode = javaCode.replace(/ , /g, ", ");

  return javaCode;
}

function formatProjectToMarkdown(project) {
  const mdLines = [];

  mdLines.push("# Código del Diagrama NSPlus\n");
  mdLines.push(`**Nombre del proyecto:** ${project.name ?? "N/A"}\n`);

  if (Object.prototype.hasOwnProperty.call(project, "diagrams")) {
    const diagrams = Array.isArray(project.diagrams) ? project.diagrams : [];
    mdLines.push(`**Cantidad de diagramas:** ${diagrams.length}\n`);
    mdLines.push("---\n\n");

    diagrams.forEach((diagram, index) => {
      mdLines.push(`## Diagrama ${index + 1}: ${diagram?.name ?? "Sin nombre"}\n`);
      mdLines.push(`**Clase:** ${diagram?.theClass ?? "N/A"}\n\n`);

      const codeHtml = diagram?.code ?? "";
      if (codeHtml) {
        const javaCode = formatDiagramCode(codeHtml);

        mdLines.push("### Código:\n");
        mdLines.push("```java\n");
        mdLines.push(javaCode);
        mdLines.push("\n```\n");
      }

      mdLines.push("---\n\n");
    });
  }

  if (Object.prototype.hasOwnProperty.call(project, "meta")) {
    mdLines.push("## Metadatos\n");
    mdLines.push("```json\n");
    mdLines.push(JSON.stringify(project.meta, null, 2));
    mdLines.push("\n```\n");
  }

  return mdLines.join("\n");
}

function decodeNsplus(rawText) {
  let envelope;

  try {
    envelope = JSON.parse(rawText);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }

  const encodedData = envelope?.data;
  if (typeof encodedData !== "string" || encodedData.length === 0) {
    throw new Error('No se encontró la clave "data" dentro del archivo.');
  }

  let reversedData = encodedData.split("").reverse().join("");
  const padding = (4 - (reversedData.length % 4)) % 4;

  if (padding > 0) {
    reversedData += "=".repeat(padding);
  }

  let binary;
  try {
    binary = atob(reversedData);
  } catch {
    throw new Error("No se pudo decodificar el bloque base64.");
  }

  const escaped = Array.from(binary, (char) => {
    const codePoint = char.charCodeAt(0);
    return codePoint > 127 ? `%${codePoint.toString(16).toUpperCase().padStart(2, "0")}` : char;
  }).join("");

  let decodedJson;
  try {
    decodedJson = decodeURIComponent(escaped);
  } catch {
    throw new Error("No se pudo reconstruir el JSON interno.");
  }

  try {
    return JSON.parse(decodedJson);
  } catch {
    throw new Error("El contenido interno no es JSON válido.");
  }
}

function buildViewerDocument(markdown, fileName, project) {
  const safeTitle = escapeHtml(fileName);
  const safeProjectName = escapeHtml(project?.name ?? "Sin nombre");
  const safeMarkdown = escapeHtml(markdown);
  const diagramCount = Array.isArray(project?.diagrams) ? project.diagrams.length : null;
  const diagramLabel = diagramCount === null ? "Diagrama(s)" : `${diagramCount} diagramas`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle} · NSPlus Markdown</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        color-scheme: dark;
        --bg: #08111c;
        --panel: rgba(10, 17, 28, 0.84);
        --border: rgba(255, 255, 255, 0.1);
        --text: #f7f3eb;
        --muted: #aeb8c8;
        --accent: #69dcc8;
        --accent-warm: #f5b56c;
        --shadow: 0 30px 90px rgba(0, 0, 0, 0.36);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Space Grotesk", "Trebuchet MS", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(105, 220, 200, 0.14), transparent 36%),
          radial-gradient(circle at top right, rgba(245, 181, 108, 0.14), transparent 34%),
          linear-gradient(160deg, #09111d 0%, #08111c 42%, #0c1624 100%);
      }

      body::before {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 52px 52px;
        mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.8), transparent 85%);
        opacity: 0.45;
      }

      main {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 40px;
      }

      .header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        flex-wrap: wrap;
      }

      .eyebrow {
        margin: 0 0 14px;
        color: var(--accent);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.24em;
        text-transform: uppercase;
      }

      .title {
        margin: 0;
        font-size: clamp(1.9rem, 4vw, 3rem);
        line-height: 0.96;
        letter-spacing: -0.05em;
      }

      .subtitle {
        margin: 12px 0 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .pill {
        padding: 12px 16px;
        border: 1px solid var(--border);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.04);
        color: #dfe7f5;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
        backdrop-filter: blur(14px);
        white-space: nowrap;
      }

      .panel {
        margin-top: 24px;
        border: 1px solid var(--border);
        border-radius: 28px;
        background: var(--panel);
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .panel-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: center;
        padding: 18px 20px;
        border-bottom: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.03);
      }

      .panel-head p {
        margin: 0;
        color: var(--muted);
        line-height: 1.55;
      }

      .source {
        margin: 0;
        padding: 22px 20px 28px;
        max-height: calc(100vh - 210px);
        overflow: auto;
        font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
        font-size: 0.95rem;
        line-height: 1.7;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--text);
      }

      .hint {
        margin-top: 12px;
        color: var(--muted);
        font-size: 0.95rem;
      }

      @media (max-width: 720px) {
        main {
          width: min(100% - 20px, 1120px);
          padding: 20px 0 28px;
        }

        .panel-head {
          flex-direction: column;
          align-items: flex-start;
        }

        .pill {
          white-space: normal;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="header">
        <div>
          <p class="eyebrow">Markdown generado</p>
          <h1 class="title">${safeTitle}</h1>
          <p class="subtitle">
            Proyecto: <strong>${safeProjectName}</strong> · ${diagramLabel}
          </p>
        </div>

        <div class="pill">Vista .md</div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <p>El contenido siguiente es el markdown exportado desde el archivo .nsplus.</p>
            <p class="hint">Podés copiarlo o guardarlo desde el navegador si lo necesitás.</p>
          </div>
        </div>

        <pre class="source">${safeMarkdown}</pre>
      </section>
    </main>
  </body>
</html>`;
}

async function processFile(file) {
  if (!file) {
    return;
  }

  if (!file.name.toLowerCase().endsWith(".nsplus")) {
    showPreviewEmpty("Elegí un archivo con extensión .nsplus.");
    setStatus("Elegí un archivo con extensión .nsplus.", "error");
    return;
  }

  setStatus(`Leyendo ${file.name}...`, "working");
  if (fileMeta) {
    fileMeta.textContent = `Archivo: ${file.name}\nTamaño: ${formatBytes(file.size)}`;
  }

  try {
    const rawText = await file.text();
    const project = decodeNsplus(rawText);
    const markdown = formatProjectToMarkdown(project);

    const viewerHtml = buildViewerDocument(markdown, file.name, project);
    showPreviewContent(viewerHtml, file.name);

    const details = [`Archivo: ${file.name}`, `Tamaño: ${formatBytes(file.size)}`];
    if (project?.name) {
      details.push(`Proyecto: ${project.name}`);
    }
    if (Array.isArray(project?.diagrams)) {
      details.push(`Diagramas: ${project.diagrams.length}`);
    }

    if (fileMeta) {
      fileMeta.textContent = details.join("\n");
    }

    setStatus(`Listo: ${file.name} se mostró en la vista previa.`, "success");
  } catch (error) {
    showPreviewEmpty(error instanceof Error ? error.message : "No se pudo procesar el archivo.");

    if (fileMeta) {
      fileMeta.textContent = `No se pudo decodificar ${file.name}.`;
    }

    setStatus(error instanceof Error ? error.message : "No se pudo procesar el archivo.", "error");
  }
}

showPreviewEmpty();

function handleFiles(fileList) {
  const file = fileList?.[0];
  if (!file) {
    return;
  }

  void processFile(file);
}

dropZone.addEventListener("click", (event) => {
  if (event.target instanceof Element && event.target.closest("button")) {
    return;
  }

  openFilePicker();
});

dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openFilePicker();
  }
});

pickFileButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  openFilePicker();
});

fileInput.addEventListener("change", (event) => {
  handleFiles(event.target.files);
  fileInput.value = "";
});

dropZone.addEventListener("dragenter", (event) => {
  event.preventDefault();
  dragDepth += 1;
  dropZone.classList.add("is-dragover");
  setStatus("Soltá el archivo para abrir el markdown.", "working");
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
});

dropZone.addEventListener("dragleave", (event) => {
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    dropZone.classList.remove("is-dragover");
    setStatus("Esperando un archivo .nsplus.", "idle");
  }
});

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove("is-dragover");
  handleFiles(event.dataTransfer.files);
});

window.addEventListener("dragover", (event) => {
  event.preventDefault();
});