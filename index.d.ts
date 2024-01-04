export interface ScannerOptions {
    parent: HTMLDivElement;
    width?: number;
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
    cornerRadius?: number;
    cornerColor?: string;
    cropBoxColor?: string;
    backdropColor?: string;
    minCropBoxWidth?: number;
    minCropBoxHeight?: number;
    cropBoxBorderWidth?: number;
    cropBoxBorderColor?: string;
    initialCorners?: {
        x: number;
        y: number;
    }[];
}
export interface Position {
    x: number;
    y: number;
}
declare class Scanner {
    #private;
    constructor(options: ScannerOptions);
    loadImg(imgSrc: string): void;
    crop({ format }: {
        format?: string | undefined;
    }): string | Promise<unknown>;
    destroy(): void;
}
export default Scanner;
