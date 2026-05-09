export type PostType = "text" | "photo" | "video" | "mixed";

export type PostAuthor = {
  id: string;
  name: string;
  avatarUrl: string;
};

export type TaggedMember = {
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
  taggedMembers: TaggedMember[];
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
    taggedMembers: [
      {
        name: "Liam Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
      },
      {
        name: "Noah Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
      },
    ],
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
    taggedMembers: [
      {
        name: "Grandma Rose",
        avatarUrl:
          "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop",
      },
      {
        name: "Uncle Ben",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      },
    ],
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
    taggedMembers: [
      {
        name: "Ella Lin",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
      },
      {
        name: "Grace Park",
        avatarUrl:
          "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop",
      },
      {
        name: "Sophie Chen",
        avatarUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      },
    ],
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
      {
        id: "media-004-c",
        type: "image",
        url: "https://images.unsplash.com/photo-1473116763249-2faaef81ccda?w=1280&h=720&fit=crop",
        alt: "Road snacks spread on a picnic blanket",
      },
      {
        id: "media-004-d",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        alt: "Family walking along the shoreline",
        durationLabel: "00:41",
      },
      {
        id: "media-004-e",
        type: "image",
        url: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1280&h=720&fit=crop",
        alt: "Sunset over the lake before heading back",
      },
      {
        id: "media-004-f",
        type: "image",
        url: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1280&h=720&fit=crop",
        alt: "Dock view with calm water and trees",
      },
    ],
    taggedMembers: [
      {
        name: "Maya Parker",
        avatarUrl:
          "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop",
      },
      {
        name: "Leo Parker",
        avatarUrl:
          "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=100&h=100&fit=crop",
      },
    ],
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
    taggedMembers: [
      {
        name: "Grandpa Joe",
        avatarUrl:
          "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=100&h=100&fit=crop",
      },
      {
        name: "Aunt Clara",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      },
      {
        name: "Uncle Dave",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      },
      {
        name: "Cousin Mia",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
      },
    ],
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
    taggedMembers: [
      {
        name: "Aunt Nora",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=100&h=100&fit=crop",
      },
      {
        name: "Uncle Ben",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      },
      {
        name: "Cousin Ava",
        avatarUrl:
          "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 22,
    commentCount: 18,
  },
  {
    id: "post-007",
    type: "photo",
    author: {
      id: "author-nina",
      name: "Nina Brooks",
      avatarUrl:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop",
    },
    createdAtLabel: "4d ago",
    body: "Three snapshots from the spring picnic. This one should show the 2-up top row with one photo below.",
    mediaItems: [
      {
        id: "media-007-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1280&h=720&fit=crop",
        alt: "Family setting up a picnic under the trees",
      },
      {
        id: "media-007-b",
        type: "image",
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1280&h=720&fit=crop",
        alt: "Picnic basket and lemonade on a blanket",
      },
      {
        id: "media-007-c",
        type: "image",
        url: "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07?w=1280&h=720&fit=crop",
        alt: "Kids running across a sunny field after lunch",
      },
    ],
    taggedMembers: [
      {
        name: "Ruby Brooks",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      },
      {
        name: "Ethan Brooks",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 39,
    commentCount: 7,
  },
  {
    id: "post-008",
    type: "photo",
    author: {
      id: "author-marcus",
      name: "Marcus Hill",
      avatarUrl:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=240&h=240&fit=crop",
    },
    createdAtLabel: "5d ago",
    body: "Weekend market haul. This one gives the full 2-by-2 preview before stack mode kicks in.",
    mediaItems: [
      {
        id: "media-008-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1280&h=720&fit=crop",
        alt: "Fresh bread and flowers at the market",
      },
      {
        id: "media-008-b",
        type: "image",
        url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1280&h=720&fit=crop",
        alt: "Seasonal produce stacked in wooden crates",
      },
      {
        id: "media-008-c",
        type: "image",
        url: "https://images.unsplash.com/photo-1502741338009-cac2772e18bc?w=1280&h=720&fit=crop",
        alt: "Coffee stop before heading home",
      },
      {
        id: "media-008-d",
        type: "image",
        url: "https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=1280&h=720&fit=crop",
        alt: "Vegetables and herbs lined up on the kitchen counter",
      },
    ],
    taggedMembers: [
      {
        name: "Tara Hill",
        avatarUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      },
      {
        name: "Noah Hill",
        avatarUrl:
          "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 44,
    commentCount: 11,
  },
  {
    id: "post-009",
    type: "mixed",
    author: {
      id: "author-leah",
      name: "Leah Carter",
      avatarUrl:
        "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=240&h=240&fit=crop",
    },
    createdAtLabel: "6d ago",
    body: "Three-item mixed post for testing before the stack kicks in.",
    mediaItems: [
      {
        id: "media-009-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1280&h=720&fit=crop",
        alt: "Blanket, snacks, and books spread out for an afternoon hangout",
      },
      {
        id: "media-009-b",
        type: "image",
        url: "https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=1280&h=720&fit=crop",
        alt: "Fresh fruit and pastries on a low picnic table",
      },
      {
        id: "media-009-c",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        alt: "Short clip of everyone packing up as the sun goes down",
        durationLabel: "00:27",
      },
    ],
    taggedMembers: [
      {
        name: "Mila Carter",
        avatarUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      },
      {
        name: "Finn Carter",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 29,
    commentCount: 4,
  },
  {
    id: "post-010",
    type: "mixed",
    author: {
      id: "author-jules",
      name: "Jules Rivera",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
    },
    createdAtLabel: "1w ago",
    body: "Four-item mixed post for testing the non-stack mixed layout at its upper limit.",
    mediaItems: [
      {
        id: "media-010-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1280&h=720&fit=crop",
        alt: "Friends arriving with bags and blankets",
      },
      {
        id: "media-010-b",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        alt: "Quick video panning across the evening setup",
        durationLabel: "00:35",
      },
      {
        id: "media-010-c",
        type: "image",
        url: "https://images.unsplash.com/photo-1478145046317-39f10e56b5e9?w=1280&h=720&fit=crop",
        alt: "Dinner plates arranged along the table",
      },
      {
        id: "media-010-d",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        alt: "Family laughing during dessert and toasts",
        durationLabel: "00:48",
      },
    ],
    taggedMembers: [
      {
        name: "Aria Rivera",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
      },
      {
        name: "Mateo Rivera",
        avatarUrl:
          "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 57,
    commentCount: 13,
  },
];
