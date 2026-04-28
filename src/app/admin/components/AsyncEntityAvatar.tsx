'use client';

import * as React from 'react';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { EntityAvatar } from './EntityAvatar';
import type { Entity } from '@/lib/types';

interface AsyncEntityAvatarProps {
    /** The entity ID to resolve the logo for */
    entityId?: string | null;
    /** The fallback display name */
    name?: string;
    /** Known source URL, will skip fetching if provided and valid */
    src?: string | null;
    /** Initials */
    initials?: string;
    /** Custom class for the avatar container */
    className?: string;
    /** Custom class for the fallback text */
    fallbackClassName?: string;
}

export function AsyncEntityAvatar({ 
    entityId, 
    name, 
    src, 
    initials,
    className, 
    fallbackClassName 
}: AsyncEntityAvatarProps) {
    const firestore = useFirestore();
    
    // Only query if we have an entityId AND we don't have a src
    const entityRef = React.useMemo(() => {
        return firestore && entityId && !src 
            ? doc(firestore, 'entities', entityId) 
            : null;
    }, [firestore, entityId, src]);

    const { data: entityDoc } = useDoc<Entity>(entityRef);

    const finalSrc = src || entityDoc?.logoUrl;
    // We update name to entity's real name if we found it, else fallback
    const finalName = entityDoc?.name || name;

    return (
        <EntityAvatar 
            src={finalSrc} 
            name={finalName} 
            initials={initials}
            className={className} 
            fallbackClassName={fallbackClassName} 
        />
    );
}
