import type { BoundingBox } from './types';

export const wait = async (time: number): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(resolve, time);
    });
};

export const toRad = (degrees: number): number => {
    return degrees * Math.PI / 180;
};

export const isBoxIntersecting = (a: BoundingBox, b: BoundingBox): boolean => {
    return (
        a.x <= (b.x + b.width) &&
        b.x <= (a.x + a.width) &&
        a.y <= (b.y + b.height) &&
        b.y <= (a.y + a.height)
    );
};
