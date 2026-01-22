import { useEffect, useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import type { Doc, Id } from '../../convex/_generated/dataModel';
import { api } from '../../convex/_generated/api';
import { type ClaimType, isCurrentEligible } from '../types/claims';
import { handleError } from '../utils/errorHandling';

/**
 * Initial claim data that can be passed for editing.
 */
export interface InitialClaimData extends Doc<"claims"> {
    sources?: Doc<"sources">[];
}

/**
 * Form state values for claim creation/editing.
 */
export interface ClaimFormState {
    claimType: ClaimType;
    dateFrom: string;
    dateTo: string;
    isCurrent: boolean;
    placeId: Id<"places"> | "";
    description: string;
    customTitle: string;
    taggedPeople: Id<"people">[];
    selectedSourceIds: Id<"sources">[];
    selectedMediaIds: Id<"media">[];
}

/**
 * Parameters for the useClaimForm hook.
 */
export interface UseClaimFormParams {
    treeId: Id<"trees">;
    subjectId: string;
    subjectType: "person" | "relationship";
    defaultClaimType?: ClaimType;
    initialClaim?: InitialClaimData | null;
    linkedMedia?: Array<Doc<"media"> & { storageUrl?: string | null }>;
    onSuccess?: () => void;
    onClose: () => void;
}

/**
 * Return type for the useClaimForm hook.
 */
export interface UseClaimFormReturn {
    // Form state
    formState: ClaimFormState;
    isSubmitting: boolean;
    
    // State setters
    setClaimType: (type: ClaimType) => void;
    setDateFrom: (date: string) => void;
    setDateTo: (date: string) => void;
    setIsCurrent: (isCurrent: boolean) => void;
    setPlaceId: (placeId: Id<"places"> | "") => void;
    setDescription: (description: string) => void;
    setCustomTitle: (title: string) => void;
    setTaggedPeople: (people: Id<"people">[]) => void;
    setSelectedSourceIds: (sourceIds: Id<"sources">[]) => void;
    setSelectedMediaIds: (mediaIds: Id<"media">[]) => void;
    
    // Form submission
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    
    // Computed values
    isCurrentEligible: boolean;
    isEditing: boolean;
}

/**
 * Custom hook for managing claim form state and submission.
 * Handles both creating new claims and editing existing ones.
 */
export function useClaimForm({
    treeId,
    subjectId,
    subjectType,
    defaultClaimType,
    initialClaim,
    linkedMedia,
    onSuccess,
    onClose,
}: UseClaimFormParams): UseClaimFormReturn {
    // Form state
    const [claimType, setClaimType] = useState<ClaimType>(defaultClaimType ?? 'birth');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [isCurrent, setIsCurrent] = useState(false);
    const [placeId, setPlaceId] = useState<Id<"places"> | "">("");
    const [description, setDescription] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [taggedPeople, setTaggedPeople] = useState<Id<"people">[]>([]);
    const [selectedSourceIds, setSelectedSourceIds] = useState<Id<"sources">[]>([]);
    const [selectedMediaIds, setSelectedMediaIds] = useState<Id<"media">[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Mutations
    const createClaim = useMutation(api.claims.create);
    const updateClaim = useMutation(api.claims.update);
    const addSource = useMutation(api.claims.addSource);
    const removeSource = useMutation(api.claims.removeSource);
    const updateMediaLinks = useMutation(api.media.updateLinks);

    const currentEligible = isCurrentEligible(claimType);
    const isEditing = Boolean(initialClaim);

    // Initialize form from initialClaim when editing
    useEffect(() => {
        if (initialClaim) {
            setClaimType(initialClaim.claimType as ClaimType);
            setDateFrom(initialClaim.value.date ?? '');
            setDateTo(initialClaim.value.dateEnd ?? '');
            setIsCurrent(Boolean(initialClaim.value.isCurrent));
            setPlaceId((initialClaim.value.placeId as Id<"places"> | undefined) ?? '');
            setDescription(initialClaim.value.description ?? '');
            const customFields = initialClaim.value.customFields as { title?: string; relatedPersonIds?: Id<"people">[] } | undefined;
            setCustomTitle(customFields?.title ?? '');
            setTaggedPeople(customFields?.relatedPersonIds ?? []);
            setSelectedSourceIds(
                (initialClaim.sources ?? []).map((source: Doc<"sources">) => source._id)
            );
            return;
        }

        // Reset form for new claim
        if (defaultClaimType) {
            setClaimType(defaultClaimType);
        }
        setDateFrom('');
        setDateTo('');
        setIsCurrent(false);
        setPlaceId('');
        setDescription('');
        setCustomTitle('');
        setTaggedPeople([]);
        setSelectedSourceIds([]);
        setSelectedMediaIds([]);
    }, [defaultClaimType, initialClaim]);

    // Sync linked media when editing
    useEffect(() => {
        if (initialClaim && linkedMedia) {
            setSelectedMediaIds(linkedMedia.map((item) => item._id));
        }
    }, [initialClaim, linkedMedia]);

    // Reset current-related fields when claim type changes
    useEffect(() => {
        if (!currentEligible) {
            setIsCurrent(false);
            setDateTo('');
        }
    }, [currentEligible]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const customFields = claimType === 'custom' && customTitle.trim()
                ? { title: customTitle.trim() }
                : undefined;
            const isCurrentValue = currentEligible && isCurrent ? true : undefined;
            const dateEndValue = currentEligible && !isCurrent ? dateTo || undefined : undefined;

            if (initialClaim) {
                // Update existing claim
                await updateClaim({
                    claimId: initialClaim._id,
                    claimType,
                    value: {
                        date: dateFrom || undefined,
                        dateEnd: dateEndValue,
                        isCurrent: isCurrentValue,
                        placeId: placeId || undefined,
                        description: description || undefined,
                        datePrecision: 'year',
                        customFields,
                    },
                    relatedPersonIds: taggedPeople.length ? taggedPeople : undefined,
                });

                // Handle source changes
                const existingSourceIds = new Set(
                    (initialClaim.sources ?? []).map((source: Doc<"sources">) => source._id)
                );
                const nextSourceIds = new Set(selectedSourceIds);

                const sourceAdds = selectedSourceIds.filter(
                    (sourceId) => !existingSourceIds.has(sourceId)
                );
                const sourceRemovals = Array.from(existingSourceIds).filter(
                    (sourceId) => !nextSourceIds.has(sourceId)
                );

                await Promise.all([
                    ...sourceAdds.map((sourceId) =>
                        addSource({ claimId: initialClaim._id, sourceId })
                    ),
                    ...sourceRemovals.map((sourceId) =>
                        removeSource({ claimId: initialClaim._id, sourceId })
                    ),
                ]);

                // Update media links
                if (subjectType === 'person') {
                    await updateMediaLinks({
                        treeId,
                        entityType: "claim",
                        entityId: initialClaim._id,
                        mediaIds: selectedMediaIds
                    });
                }
            } else {
                // Create new claim
                const claimId = await createClaim({
                    treeId,
                    subjectType,
                    subjectId,
                    claimType,
                    value: {
                        date: dateFrom || undefined,
                        dateEnd: dateEndValue,
                        isCurrent: isCurrentValue,
                        placeId: placeId || undefined,
                        description: description || undefined,
                        datePrecision: 'year',
                        customFields,
                    },
                    relatedPersonIds: taggedPeople.length ? taggedPeople : undefined,
                    status: 'accepted',
                    confidence: 'high',
                }) as Id<"claims">;

                // Add sources
                await Promise.all(
                    selectedSourceIds.map((sourceId) =>
                        addSource({ claimId, sourceId })
                    )
                );

                // Add media links
                if (subjectType === 'person') {
                    await updateMediaLinks({
                        treeId,
                        entityType: "claim",
                        entityId: claimId,
                        mediaIds: selectedMediaIds
                    });
                }
            }

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            handleError(error, { operation: 'save claim' });
        } finally {
            setIsSubmitting(false);
        }
    }, [
        claimType, dateFrom, dateTo, isCurrent, placeId, description, customTitle,
        taggedPeople, selectedSourceIds, selectedMediaIds, currentEligible,
        initialClaim, treeId, subjectId, subjectType,
        createClaim, updateClaim, addSource, removeSource, updateMediaLinks,
        onSuccess, onClose
    ]);

    return {
        formState: {
            claimType,
            dateFrom,
            dateTo,
            isCurrent,
            placeId,
            description,
            customTitle,
            taggedPeople,
            selectedSourceIds,
            selectedMediaIds,
        },
        isSubmitting,
        setClaimType,
        setDateFrom,
        setDateTo,
        setIsCurrent,
        setPlaceId,
        setDescription,
        setCustomTitle,
        setTaggedPeople,
        setSelectedSourceIds,
        setSelectedMediaIds,
        handleSubmit,
        isCurrentEligible: currentEligible,
        isEditing,
    };
}
