"use client";

import { GalleryMediaTile } from "./gallery-media-tile";
import type { FamilyGalleryItem } from "./gallery-types";

type GalleryBentoGridProps = {
  items: FamilyGalleryItem[];
  onTileClick?: (index: number) => void;
};

function hashString(value: string) {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getBentoTileClass(positionInGroup: number, bigTilePosition: number) {
  if (positionInGroup === bigTilePosition) {
    return "col-span-1 aspect-4/5 lg:col-span-2 lg:aspect-[8/5]";
  }

  return "col-span-1 aspect-4/5 lg:col-span-1";
}

export function GalleryBentoGrid({ items, onTileClick }: GalleryBentoGridProps) {
  if (items.length === 0) {
    return null;
  }

  const bigTilePositionByGroup = items.reduce<number[]>((positions, item, index) => {
    const isGroupStart = index % 3 === 0;

    if (!isGroupStart) {
      return positions;
    }

    const groupItems = items.slice(index, index + 3);
    const groupSize = groupItems.length;
    const hashed = hashString(groupItems.map((groupItem) => groupItem.id).join("|"));
    positions.push(hashed % Math.max(groupSize, 1));

    return positions;
  }, []);

  return (
    <ul className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={getBentoTileClass(
            index % 3,
            bigTilePositionByGroup[Math.floor(index / 3)] ?? 0,
          )}
        >
          <GalleryMediaTile
            item={item}
            onClick={() => onTileClick?.(index)}
            className="h-full"
            priority={index < 4}
            sizes={
              index % 3 === (bigTilePositionByGroup[Math.floor(index / 3)] ?? 0)
                ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 50vw"
                : "(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 25vw"
            }
          />
        </li>
      ))}
    </ul>
  );
}
