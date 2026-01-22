import { jsPDF } from 'jspdf';

export type ChartExportFormat = 'png' | 'pdf';

export interface ChartExportConfig {
    svg: SVGSVGElement;
    fileName: string;
    width: number;
    height: number;
    scale?: number;
    backgroundColor?: string;
}

const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load chart image'));
    image.src = src;
});

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
};

const chartCssVariables = [
    '--color-surface',
    '--color-border',
    '--color-accent',
    '--color-accent-subtle',
    '--color-secondary',
    '--color-text-primary',
    '--color-text-muted',
    '--color-text-inverse'
];

const buildSvgMarkup = (svg: SVGSVGElement, width: number, height: number, fontFamily: string) => {
    const cloned = svg.cloneNode(true) as SVGSVGElement;
    cloned.setAttribute('width', `${width}`);
    cloned.setAttribute('height', `${height}`);
    cloned.setAttribute('viewBox', `0 0 ${width} ${height}`);
    cloned.removeAttribute('style');

    const variableStyles = chartCssVariables
        .map((name) => {
            const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return value ? `${name}: ${value};` : '';
        })
        .filter(Boolean)
        .join(' ');

    // Get computed font values
    const fontSerif = getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim() || 
        "'Merriweather', Georgia, 'Times New Roman', serif";
    const fontSans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 
        "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = `
        svg { ${variableStyles} }
        text { font-family: ${fontFamily}; }
        .font-bold { font-weight: 700; }
        .text-sm { font-size: 12px; }
        .text-xs { font-size: 10px; }
        .fan-chart-svg {
            font-family: ${fontSerif};
        }
        .fan-chart-label {
            font-size: 0.78rem;
            fill: var(--color-text-primary);
        }
        .fan-chart-label.is-dimmed {
            opacity: 0.5;
        }
        .fan-chart-status {
            font-size: 0.62rem;
            fill: var(--color-text-muted);
            font-family: ${fontSans};
        }
        .fan-chart-root {
            stroke: rgba(255, 255, 255, 0.9);
            stroke-width: 2;
            filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.12));
        }
        .fan-chart-root-label {
            font-size: 0.9rem;
            font-weight: 600;
            fill: var(--color-text-inverse);
        }
        .fan-chart-root-label .fan-chart-status {
            fill: rgba(255, 255, 255, 0.78);
        }
    `;
    cloned.insertBefore(style, cloned.firstChild);
    return new XMLSerializer().serializeToString(cloned);
};

const createCanvasFromSvg = async (config: ChartExportConfig) => {
    const scale = config.scale ?? 1;
    const outputWidth = Math.round(config.width * scale);
    const outputHeight = Math.round(config.height * scale);
    const fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const svgMarkup = buildSvgMarkup(config.svg, config.width, config.height, fontFamily);
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
        const image = await loadImage(svgUrl);
        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas context unavailable');
        }

        const backgroundColor = config.backgroundColor ?? (
            getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim() || '#ffffff'
        );

        context.fillStyle = backgroundColor;
        context.fillRect(0, 0, outputWidth, outputHeight);
        context.drawImage(image, 0, 0, outputWidth, outputHeight);
        return canvas;
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
};

export const exportSvgChart = async (format: ChartExportFormat, config: ChartExportConfig) => {
    const canvas = await createCanvasFromSvg(config);

    if (format === 'png') {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
            throw new Error('PNG export failed');
        }
        downloadBlob(blob, `${config.fileName}.png`);
        return;
    }

    const dataUrl = canvas.toDataURL('image/png');
    const width = canvas.width;
    const height = canvas.height;
    const pdf = new jsPDF({
        orientation: width >= height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`${config.fileName}.pdf`);
};
