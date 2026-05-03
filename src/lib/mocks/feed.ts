export type PostType = "text" | "photo" | "video" | "mixed";

export type PostAuthor = {
  id: string;
  name: string;
  avatarUrl: string;
};

export type PostMediaItem = {
  id: string;
  type: "image" | "video";
  url: string;
  alt: string;
  durationLabel?: string;
};

export type FeedPost = {
  id: string;
  type: PostType;
  author: PostAuthor;
  createdAtLabel: string;
  body: string;
  mediaItems: PostMediaItem[];
  taggedMembers: string[];
  reactionCount: number;
  commentCount: number;
};

export const feedPosts: FeedPost[] = [
  {
    id: "post-001",
    type: "text",
    author: {
      id: "author-amy",
      name: "Amy Johnson",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
    },
    createdAtLabel: "2h ago",
    body: "Sunday dinner plan: pasta, garlic bread, and movie night after.",
    mediaItems: [],
    taggedMembers: ["Liam", "Noah"],
    reactionCount: 14,
    commentCount: 3,
  },
  {
    id: "post-002",
    type: "photo",
    author: {
      id: "author-dan",
      name: "Dan Johnson",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop",
    },
    createdAtLabel: "4h ago",
    body: "Garden cleanup done. Tomatoes are finally coming in.",
    mediaItems: [
      {
        id: "media-002-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1280&h=720&fit=crop",
        alt: "Tomato plants in a family garden",
      },
      {
        id: "media-002-b",
        type: "image",
        url: "https://images.unsplash.com/photo-1438109491414-7198515b166b?w=1280&h=720&fit=crop",
        alt: "Harvest basket with fresh vegetables",
      },
    ],
    taggedMembers: ["Grandma Rose"],
    reactionCount: 27,
    commentCount: 6,
  },
  {
    id: "post-003",
    type: "video",
    author: {
      id: "author-mei",
      name: "Mei Lin",
      avatarUrl:
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=240&h=240&fit=crop",
    },
    createdAtLabel: "Yesterday",
    body: "Ella's piano recital highlight.",
    mediaItems: [
      {
        id: "media-003-a",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        alt: "Piano recital clip",
        durationLabel: "01:12",
      },
    ],
    taggedMembers: ["Ella"],
    reactionCount: 45,
    commentCount: 12,
  },
  {
    id: "post-004",
    type: "mixed",
    author: {
      id: "author-sam",
      name: "Sam Parker",
      avatarUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&h=240&fit=crop",
    },
    createdAtLabel: "Yesterday",
    body: "Road trip stop at the lake. Kids skipped stones for an hour.",
    mediaItems: [
      {
        id: "media-004-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1280&h=720&fit=crop",
        alt: "Family at a lakeside stop",
      },
      {
        id: "media-004-b",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        alt: "Kids skipping stones at a lake",
        durationLabel: "00:34",
      },
    ],
    taggedMembers: ["Maya", "Leo"],
    reactionCount: 33,
    commentCount: 5,
  },
  {
    id: "post-005",
    type: "photo",
    author: {
      id: "author-zoe",
      name: "Zoe Parker",
      avatarUrl:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop",
    },
    createdAtLabel: "2d ago",
    body: "Grandpa's birthday cake reveal.",
    mediaItems: [
      {
        id: "media-005-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1535141192574-5d4897c12636?w=1280&h=720&fit=crop",
        alt: "Birthday cake with candles",
      },
    ],
    taggedMembers: ["Grandpa Joe"],
    reactionCount: 51,
    commentCount: 9,
  },
  {
    id: "post-006",
    type: "text",
    author: {
      id: "author-oliver",
      name: "Oliver Reed",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&h=240&fit=crop",
    },
    createdAtLabel: "3d ago",
    body: "Planning the summer reunion. Vote in comments: beach house or mountain cabin?",
    mediaItems: [],
    taggedMembers: ["Aunt Nora", "Uncle Ben", "Cousin Ava"],
    reactionCount: 22,
    commentCount: 18,
  },
];
