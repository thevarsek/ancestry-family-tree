import type { Doc } from '../../../convex/_generated/dataModel';

export interface PersonWithPhoto extends Doc<"people"> {
    profilePhotoUrl?: string;
    profilePhotoZoom?: number;
    profilePhotoFocusX?: number;
    profilePhotoFocusY?: number;
    profilePhotoWidth?: number;
    profilePhotoHeight?: number;
}
