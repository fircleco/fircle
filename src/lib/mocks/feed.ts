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
    body: "Sunday dinner plan: pasta, garlic bread, and movie night after. @Liam Johnson and @Noah Johnson — don't be late!",
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

  // ── Emma Shittabey ──────────────────────────────────────────────────────────
  {
    id: "post-011",
    type: "text",
    author: {
      id: "member-emma-shittabey",
      name: "Emma Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
    },
    createdAtLabel: "1h ago",
    body: "Family game night is back on this Friday! @Noah Shittabey please don't forget the snacks this time 😅",
    mediaItems: [],
    taggedMembers: [
      {
        name: "Noah Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 18,
    commentCount: 5,
  },
  {
    id: "post-012",
    type: "photo",
    author: {
      id: "member-emma-shittabey",
      name: "Emma Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
    },
    createdAtLabel: "3d ago",
    body: "Baked Grandma Evelyn's famous lemon cake for the first time. Not bad for a first try!",
    mediaItems: [
      {
        id: "media-012-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=1280&h=720&fit=crop",
        alt: "Homemade lemon cake on the kitchen counter",
      },
      {
        id: "media-012-b",
        type: "image",
        url: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1280&h=720&fit=crop",
        alt: "A slice of the lemon cake on a plate",
      },
    ],
    taggedMembers: [
      {
        name: "Evelyn Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      },
      {
        name: "Lily Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 34,
    commentCount: 8,
  },

  // ── Noah Shittabey ──────────────────────────────────────────────────────────
  {
    id: "post-013",
    type: "text",
    author: {
      id: "member-noah-shittabey",
      name: "Noah Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop",
    },
    createdAtLabel: "2h ago",
    body: "Finished putting together the new bookshelf. Took three hours and one minor injury but we got there. @Emma Shittabey — your turn to decide what goes on it.",
    mediaItems: [],
    taggedMembers: [
      {
        name: "Emma Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 21,
    commentCount: 4,
  },
  {
    id: "post-014",
    type: "photo",
    author: {
      id: "member-noah-shittabey",
      name: "Noah Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop",
    },
    createdAtLabel: "5d ago",
    body: "Saturday morning hike with @Lily Shittabey and @Logan Ross. The views were absolutely worth it.",
    mediaItems: [
      {
        id: "media-014-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1280&h=720&fit=crop",
        alt: "Mountain trail at sunrise",
      },
      {
        id: "media-014-b",
        type: "image",
        url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&h=720&fit=crop",
        alt: "Panoramic valley view from the summit",
      },
      {
        id: "media-014-c",
        type: "image",
        url: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=1280&h=720&fit=crop",
        alt: "Forest path through pine trees",
      },
    ],
    taggedMembers: [
      {
        name: "Lily Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
      },
      {
        name: "Logan Ross",
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 46,
    commentCount: 11,
  },

  // ── Lily Shittabey ───────────────────────────────────────────────────────────
  {
    id: "post-015",
    type: "text",
    author: {
      id: "member-lily-shittabey",
      name: "Lily Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop",
    },
    createdAtLabel: "30m ago",
    body: "Just got my exam results back — passed with distinction! Couldn't have done it without the support from this whole family 🎉",
    mediaItems: [],
    taggedMembers: [],
    reactionCount: 62,
    commentCount: 14,
  },
  {
    id: "post-016",
    type: "video",
    author: {
      id: "member-lily-shittabey",
      name: "Lily Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=240&h=240&fit=crop",
    },
    createdAtLabel: "1w ago",
    body: "Quick clip from our pottery class. @Ava Kim this one's for you — told you I'd share it!",
    mediaItems: [
      {
        id: "media-016-a",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        alt: "Hands shaping clay on a pottery wheel",
        durationLabel: "00:45",
      },
    ],
    taggedMembers: [
      {
        name: "Ava Kim",
        avatarUrl:
          "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 38,
    commentCount: 7,
  },

  // ── Evelyn Shittabey ─────────────────────────────────────────────────────────
  {
    id: "post-017",
    type: "text",
    author: {
      id: "member-evelyn-shittabey",
      name: "Evelyn Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=240&h=240&fit=crop",
    },
    createdAtLabel: "2d ago",
    body: "Sitting in the garden this morning thinking about how lucky I am to have @Emma Shittabey and @Noah Shittabey looking after things. This family is everything.",
    mediaItems: [],
    taggedMembers: [
      {
        name: "Emma Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      },
      {
        name: "Noah Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 77,
    commentCount: 16,
  },
  {
    id: "post-018",
    type: "photo",
    author: {
      id: "member-evelyn-shittabey",
      name: "Evelyn Shittabey",
      avatarUrl:
        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=240&h=240&fit=crop",
    },
    createdAtLabel: "1w ago",
    body: "My rose bushes are blooming again. Best time of year in this garden.",
    mediaItems: [
      {
        id: "media-018-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1502977249166-824b3a8a4d6d?w=1280&h=720&fit=crop",
        alt: "Pink rose bushes in full bloom",
      },
    ],
    taggedMembers: [],
    reactionCount: 54,
    commentCount: 9,
  },

  // ── Logan Ross ───────────────────────────────────────────────────────────────
  {
    id: "post-019",
    type: "text",
    author: {
      id: "member-logan-ross",
      name: "Logan Ross",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&h=240&fit=crop",
    },
    createdAtLabel: "4h ago",
    body: "Anyone up for a barbecue this weekend? I'm thinking Sunday afternoon. @Noah Shittabey already volunteered to man the grill.",
    mediaItems: [],
    taggedMembers: [
      {
        name: "Noah Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 19,
    commentCount: 6,
  },
  {
    id: "post-020",
    type: "mixed",
    author: {
      id: "member-logan-ross",
      name: "Logan Ross",
      avatarUrl:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=240&h=240&fit=crop",
    },
    createdAtLabel: "6d ago",
    body: "Weekend in the city with @Nina Ross. Highlights: street food, live music, and getting completely lost twice.",
    mediaItems: [
      {
        id: "media-020-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1280&h=720&fit=crop",
        alt: "City skyline at dusk",
      },
      {
        id: "media-020-b",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        alt: "Street musician performing on a busy corner",
        durationLabel: "00:32",
      },
      {
        id: "media-020-c",
        type: "image",
        url: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1280&h=720&fit=crop",
        alt: "Food market stalls lit up at night",
      },
    ],
    taggedMembers: [
      {
        name: "Nina Ross",
        avatarUrl: "",
      },
    ],
    reactionCount: 41,
    commentCount: 10,
  },

  // ── Nina Ross ────────────────────────────────────────────────────────────────
  {
    id: "post-021",
    type: "text",
    author: {
      id: "member-nina-ross",
      name: "Nina Ross",
      avatarUrl: "",
    },
    createdAtLabel: "3h ago",
    body: "Had such a great time visiting @Logan Ross last weekend. Already planning the next trip!",
    mediaItems: [],
    taggedMembers: [
      {
        name: "Logan Ross",
        avatarUrl:
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 15,
    commentCount: 3,
  },
  {
    id: "post-022",
    type: "photo",
    author: {
      id: "member-nina-ross",
      name: "Nina Ross",
      avatarUrl: "",
    },
    createdAtLabel: "4d ago",
    body: "Morning coffee and a good book. My perfect Saturday.",
    mediaItems: [
      {
        id: "media-022-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1280&h=720&fit=crop",
        alt: "Coffee cup beside an open book on a wooden table",
      },
    ],
    taggedMembers: [],
    reactionCount: 23,
    commentCount: 2,
  },

  // ── Ben Harper ───────────────────────────────────────────────────────────────
  {
    id: "post-023",
    type: "photo",
    author: {
      id: "member-ben-harper",
      name: "Ben Harper",
      avatarUrl:
        "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=240&h=240&fit=crop",
    },
    createdAtLabel: "1d ago",
    body: "Spent the afternoon fixing up the old car. Progress is slow but it's coming together. @Noah Shittabey you'd appreciate this.",
    mediaItems: [
      {
        id: "media-023-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1280&h=720&fit=crop",
        alt: "Classic car with the hood open in a garage",
      },
      {
        id: "media-023-b",
        type: "image",
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1280&h=720&fit=crop",
        alt: "Engine components laid out on a workbench",
      },
    ],
    taggedMembers: [
      {
        name: "Noah Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 30,
    commentCount: 7,
  },
  {
    id: "post-024",
    type: "text",
    author: {
      id: "member-ben-harper",
      name: "Ben Harper",
      avatarUrl:
        "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=240&h=240&fit=crop",
    },
    createdAtLabel: "3d ago",
    body: "Finally tried that new ramen place downtown. Solid 9/10 — the broth was incredible. Highly recommend.",
    mediaItems: [],
    taggedMembers: [],
    reactionCount: 12,
    commentCount: 4,
  },

  // ── Ava Kim ──────────────────────────────────────────────────────────────────
  {
    id: "post-025",
    type: "text",
    author: {
      id: "member-ava-kim",
      name: "Ava Kim",
      avatarUrl:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop",
    },
    createdAtLabel: "5h ago",
    body: "So grateful to the Shittabey family for making me feel like one of their own. @Emma Shittabey your hospitality is unmatched!",
    mediaItems: [],
    taggedMembers: [
      {
        name: "Emma Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 49,
    commentCount: 8,
  },
  {
    id: "post-026",
    type: "mixed",
    author: {
      id: "member-ava-kim",
      name: "Ava Kim",
      avatarUrl:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=240&h=240&fit=crop",
    },
    createdAtLabel: "2d ago",
    body: "Pottery class recap! @Lily Shittabey this was such a fun idea. We're definitely going back.",
    mediaItems: [
      {
        id: "media-026-a",
        type: "image",
        url: "https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1280&h=720&fit=crop",
        alt: "Completed pottery pieces drying on a shelf",
      },
      {
        id: "media-026-b",
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
        alt: "Timelapse of Ava shaping a bowl on the wheel",
        durationLabel: "00:22",
      },
    ],
    taggedMembers: [
      {
        name: "Lily Shittabey",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
      },
    ],
    reactionCount: 36,
    commentCount: 6,
  },
];

// ── Comments ────────────────────────────────────────────────────────────────

export type PostComment = {
  id: string;
  author: {
    name: string;
    avatarUrl: string;
  };
  body: string;
  createdAtLabel: string;
  reactionCount: number;
};

export const postComments: Record<string, PostComment[]> = {
  "post-001": [
    {
      id: "c-001-1",
      author: {
        name: "Liam Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
      },
      body: "I'll be there on time, promise! 🍝",
      createdAtLabel: "2h ago",
      reactionCount: 3,
    },
    {
      id: "c-001-2",
      author: {
        name: "Noah Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
      },
      body: "Can we do a horror movie this time?",
      createdAtLabel: "1h ago",
      reactionCount: 1,
    },
    {
      id: "c-001-3",
      author: {
        name: "Amy Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
      },
      body: "No horror, it's a family night 😄",
      createdAtLabel: "58m ago",
      reactionCount: 5,
    },
  ],
  "post-002": [
    {
      id: "c-002-1",
      author: {
        name: "Grandma Rose",
        avatarUrl:
          "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=100&h=100&fit=crop",
      },
      body: "Those tomatoes look gorgeous! Save some for me.",
      createdAtLabel: "3h ago",
      reactionCount: 7,
    },
    {
      id: "c-002-2",
      author: {
        name: "Uncle Ben",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      },
      body: "The garden has never looked better. Great work, Dan.",
      createdAtLabel: "2h ago",
      reactionCount: 4,
    },
    {
      id: "c-002-3",
      author: {
        name: "Amy Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=240&h=240&fit=crop",
      },
      body: "Drop some off next time you come over!",
      createdAtLabel: "1h ago",
      reactionCount: 2,
    },
    {
      id: "c-002-4",
      author: {
        name: "Dan Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=240&h=240&fit=crop",
      },
      body: "Will do. I've got more than I can use anyway 🍅",
      createdAtLabel: "45m ago",
      reactionCount: 6,
    },
    {
      id: "c-002-5",
      author: {
        name: "Liam Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop",
      },
      body: "Homemade pasta sauce incoming 👨‍🍳",
      createdAtLabel: "30m ago",
      reactionCount: 8,
    },
    {
      id: "c-002-6",
      author: {
        name: "Noah Johnson",
        avatarUrl:
          "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100&h=100&fit=crop",
      },
      body: "Count me in for dinner!",
      createdAtLabel: "15m ago",
      reactionCount: 3,
    },
  ],
  "post-003": [
    {
      id: "c-003-1",
      author: {
        name: "Grace Park",
        avatarUrl:
          "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=100&h=100&fit=crop",
      },
      body: "Ella was absolutely brilliant! So proud of her.",
      createdAtLabel: "Yesterday",
      reactionCount: 12,
    },
    {
      id: "c-003-2",
      author: {
        name: "Sophie Chen",
        avatarUrl:
          "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
      },
      body: "That middle section gave me chills! She nailed it.",
      createdAtLabel: "Yesterday",
      reactionCount: 9,
    },
    {
      id: "c-003-3",
      author: {
        name: "Ella Lin",
        avatarUrl:
          "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop",
      },
      body: "Thank you all so much, I was so nervous! 🎹",
      createdAtLabel: "Yesterday",
      reactionCount: 18,
    },
  ],
  "post-006": [
    {
      id: "c-006-1",
      author: {
        name: "Aunt Nora",
        avatarUrl:
          "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=100&h=100&fit=crop",
      },
      body: "Beach house — hands down! 🏖️",
      createdAtLabel: "3d ago",
      reactionCount: 6,
    },
    {
      id: "c-006-2",
      author: {
        name: "Uncle Ben",
        avatarUrl:
          "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
      },
      body: "Mountain cabin for me. Cooler temps, better hikes.",
      createdAtLabel: "3d ago",
      reactionCount: 5,
    },
    {
      id: "c-006-3",
      author: {
        name: "Cousin Ava",
        avatarUrl:
          "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop",
      },
      body: "Why not both? Split the week? 😅",
      createdAtLabel: "2d ago",
      reactionCount: 14,
    },
  ],
};
