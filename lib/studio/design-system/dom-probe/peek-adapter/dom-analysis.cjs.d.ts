import type { DomComponentCue, DomPaletteCapture, DomProbeDiagnostics, DomSpacingCapture, DomTypographySample } from '../types';
export interface DomAnalysisOptions {
    maxElements?: number;
    minTextLength?: number;
    sampleLimit?: number;
    colorSampleLimit?: number;
}
export interface DomAnalysisResult {
    typography: DomTypographySample[];
    palette: DomPaletteCapture;
    spacing: DomSpacingCapture;
    components: DomComponentCue[];
    diagnostics: DomProbeDiagnostics;
}
type DocumentLike = Document & {
    fonts?: {
        check: (font: string) => boolean;
    };
};
type WindowLike = Window & {
    getComputedStyle(element: Element): CSSStyleDeclaration;
};
declare const analysisImplementation: (documentRef: DocumentLike, windowRef: WindowLike | null, options?: DomAnalysisOptions) => DomAnalysisResult;
export type AnalysisImplementation = typeof analysisImplementation;
export declare function analyzeDomDocument(documentRef: DocumentLike, options?: DomAnalysisOptions): DomAnalysisResult;
export declare function analyzeDom(options?: DomAnalysisOptions): DomAnalysisResult;
export { analysisImplementation as __INTERNAL_ANALYSIS_IMPLEMENTATION };
