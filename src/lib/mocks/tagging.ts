import {
  familyMembers,
  type FamilyMemberStatus,
} from "~/lib/mocks/family-members";

export type TaggedPerson = {
  memberId: string;
  name: string;
  status: FamilyMemberStatus;
  avatarUrl?: string;
};

export type PhotoTagAnchor = {
  id: string;
  xPercent: number;
  yPercent: number;
  person: TaggedPerson;
  label?: string;
};

export type VideoTagMoment = {
  id: string;
  atSeconds: number;
  atLabel: string;
  people: TaggedPerson[];
  note?: string;
};

export type TaggedMemoryItem = {
  id: string;
  type: "photo" | "video" | "post";
  title: string;
  caption: string;
  authorName: string;
  createdAtLabel: string;
  thumbnailUrl?: string;
  taggedPeople: TaggedPerson[];
};

export type TagNotificationItem = {
  id: string;
  category: "tags" | "invites" | "system";
  event:
    | "tag-photo"
    | "tag-video"
    | "family-member-tagged"
    | "unclaimed-member-tagged";
  title: string;
  body: string;
  createdAtLabel: string;
  isRead: boolean;
  thumbnailUrl?: string;
  people: TaggedPerson[];
};

export type PhotoTaggingExample = {
  id: string;
  title: string;
  helperText: string;
  imageUrl: string;
  anchors: PhotoTagAnchor[];
};

export type VideoTaggingExample = {
  id: string;
  title: string;
  helperText: string;
  posterUrl: string;
  durationLabel: string;
  currentTimeLabel: string;
  moments: VideoTagMoment[];
};

const getTaggedPerson = (memberId: string): TaggedPerson => {
  const member = familyMembers.find((item) => item.id === memberId);

  if (!member) {
    throw new Error(`Missing family member for tag mock: ${memberId}`);
  }

  return {
    memberId: member.id,
    name: member.name,
    status: member.status,
    avatarUrl: member.avatarUrl,
  };
};

const emma = getTaggedPerson("member-emma-shittabey");
const noah = getTaggedPerson("member-noah-shittabey");
const lily = getTaggedPerson("member-lily-shittabey");
const evelyn = getTaggedPerson("member-evelyn-shittabey");
const nina = getTaggedPerson("member-nina-ross");
const ava = getTaggedPerson("member-ava-kim");
const logan = getTaggedPerson("member-logan-ross");
const ben = getTaggedPerson("member-ben-harper");

export const photoTaggingExamples: PhotoTaggingExample[] = [
  {
    id: "photo-summer-picnic",
    title: "Summer picnic",
    helperText: "Tap markers to preview how people will be attached to the memory.",
    imageUrl:
      "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=1200&h=900&fit=crop",
    anchors: [
      { id: "anchor-emma", xPercent: 24, yPercent: 31, person: emma, label: "Holding the camera bag" },
      { id: "anchor-lily", xPercent: 54, yPercent: 45, person: lily, label: "Front of picnic table" },
      { id: "anchor-evelyn", xPercent: 76, yPercent: 29, person: evelyn, label: "Waving from the bench" },
    ],
  },
  {
    id: "photo-birthday-cake",
    title: "Birthday cake moment",
    helperText: "Dense tagging example with mixed claimed and unclaimed members.",
    imageUrl:
      "https://images.unsplash.com/photo-1464349153735-7db50ed83c84?w=1200&h=900&fit=crop",
    anchors: [
      { id: "anchor-noah", xPercent: 35, yPercent: 28, person: noah, label: "Lighting candles" },
      { id: "anchor-nina", xPercent: 61, yPercent: 34, person: nina, label: "Leaning in from the right" },
      { id: "anchor-ava", xPercent: 48, yPercent: 48, person: ava, label: "Center table laugh" },
      { id: "anchor-logan", xPercent: 71, yPercent: 56, person: logan, label: "Cutting slices" },
      { id: "anchor-ben", xPercent: 22, yPercent: 58, person: ben, label: "Holding extra plates" },
    ],
  },
];

export const videoTaggingExamples: VideoTaggingExample[] = [
  {
    id: "video-soccer-recap",
    title: "Saturday soccer recap",
    helperText: "Timeline markers show when someone appears in the clip.",
    posterUrl:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&h=675&fit=crop",
    durationLabel: "01:24",
    currentTimeLabel: "00:37",
    moments: [
      { id: "moment-1", atSeconds: 12, atLabel: "00:12", people: [lily], note: "Kickoff close-up" },
      { id: "moment-2", atSeconds: 37, atLabel: "00:37", people: [noah, lily], note: "Cheering from sidelines" },
      { id: "moment-3", atSeconds: 58, atLabel: "00:58", people: [ava], note: "Victory hug" },
    ],
  },
  {
    id: "video-winter-toast",
    title: "Winter holiday toast",
    helperText: "Static preview of multiple family members tagged at one moment.",
    posterUrl:
      "https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=1200&h=675&fit=crop",
    durationLabel: "00:48",
    currentTimeLabel: "00:19",
    moments: [
      { id: "moment-4", atSeconds: 8, atLabel: "00:08", people: [emma, evelyn], note: "Opening cheers" },
      { id: "moment-5", atSeconds: 19, atLabel: "00:19", people: [emma, noah, nina], note: "Family toast" },
    ],
  },
];

export const taggedMemoryItems: TaggedMemoryItem[] = [
  {
    id: "memory-1",
    type: "photo",
    title: "Garden brunch",
    caption: "First warm weekend outside together.",
    authorName: "Emma Shittabey",
    createdAtLabel: "2 days ago",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=640&h=640&fit=crop",
    taggedPeople: [emma, lily, evelyn],
  },
  {
    id: "memory-2",
    type: "video",
    title: "Pool jump countdown",
    caption: "Everyone screaming before the splash.",
    authorName: "Noah Shittabey",
    createdAtLabel: "5 days ago",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=640&h=640&fit=crop",
    taggedPeople: [lily, ava],
  },
  {
    id: "memory-3",
    type: "post",
    title: "Grandma's recipe night",
    caption: "Saving notes from Evelyn's dumpling lesson.",
    authorName: "Emma Shittabey",
    createdAtLabel: "1 week ago",
    taggedPeople: [evelyn, nina],
  },
  {
    id: "memory-4",
    type: "photo",
    title: "Library afternoon",
    caption: "Quiet cousins corner with too many books.",
    authorName: "Logan Ross",
    createdAtLabel: "9 days ago",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=640&h=640&fit=crop",
    taggedPeople: [nina, lily],
  },
  {
    id: "memory-5",
    type: "video",
    title: "Birthday song remix",
    caption: "No one stayed on key and that made it better.",
    authorName: "Ava Kim",
    createdAtLabel: "2 weeks ago",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=640&h=640&fit=crop",
    taggedPeople: [emma, noah, lily],
  },
  {
    id: "memory-6",
    type: "photo",
    title: "Market run",
    caption: "Fresh flowers, oranges, and a very serious shopping list.",
    authorName: "Noah Shittabey",
    createdAtLabel: "3 weeks ago",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=640&h=640&fit=crop",
    taggedPeople: [emma, evelyn],
  },
  {
    id: "memory-7",
    type: "post",
    title: "Camp packing checklist",
    caption: "Tagged the people who still need to bring blankets.",
    authorName: "Emma Shittabey",
    createdAtLabel: "1 month ago",
    taggedPeople: [ava, nina],
  },
  {
    id: "memory-8",
    type: "photo",
    title: "Porch sunset",
    caption: "One of those evenings where nobody wanted to go inside.",
    authorName: "Emma Shittabey",
    createdAtLabel: "1 month ago",
    thumbnailUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=640&h=640&fit=crop",
    taggedPeople: [ava, lily, evelyn],
  },
];

export const tagNotifications: TagNotificationItem[] = [
  {
    id: "notification-1",
    category: "tags",
    event: "tag-photo",
    title: "You were tagged in Garden brunch",
    body: "Emma tagged you in a new family photo.",
    createdAtLabel: "10m ago",
    isRead: false,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=240&h=240&fit=crop",
    people: [ava],
  },
  {
    id: "notification-2",
    category: "tags",
    event: "tag-video",
    title: "Lily was tagged in Saturday soccer recap",
    body: "Noah marked Lily at 00:37 in the video timeline.",
    createdAtLabel: "42m ago",
    isRead: false,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=240&h=240&fit=crop",
    people: [lily],
  },
  {
    id: "notification-3",
    category: "tags",
    event: "family-member-tagged",
    title: "Emma tagged Noah in Birthday song remix",
    body: "A new video memory includes Noah in the birthday song moment.",
    createdAtLabel: "3h ago",
    isRead: true,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=240&h=240&fit=crop",
    people: [noah],
  },
  {
    id: "notification-4",
    category: "tags",
    event: "unclaimed-member-tagged",
    title: "Nina Ross was tagged before claiming her profile",
    body: "This memory will appear in Nina's archive once she joins Fircle.",
    createdAtLabel: "Yesterday",
    isRead: true,
    thumbnailUrl:
      "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=240&h=240&fit=crop",
    people: [nina],
  },
  {
    id: "notification-5",
    category: "invites",
    event: "family-member-tagged",
    title: "Evelyn's invite is still pending",
    body: "She was tagged in two new memories this week.",
    createdAtLabel: "2 days ago",
    isRead: true,
    people: [evelyn],
  },
  {
    id: "notification-6",
    category: "system",
    event: "tag-photo",
    title: "Memory archive preview updated",
    body: "Tagged memories are ready to browse by person in the next UI milestone.",
    createdAtLabel: "3 days ago",
    isRead: true,
    people: [emma, ava],
  },
];

export const getTaggedMemoriesByMemberId = (memberId: string) =>
  taggedMemoryItems.filter((item) => item.taggedPeople.some((person) => person.memberId === memberId));
