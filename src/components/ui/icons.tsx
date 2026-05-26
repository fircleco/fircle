import * as HugeiconsCore from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  strokeWidth?: number;
};

const coreIcons = HugeiconsCore as Record<string, unknown>;
const fallbackIcon = coreIcons.Search01Icon;

const createIcon = (iconName: string) => {
  const icon = coreIcons[iconName] ?? fallbackIcon;

  const Icon = ({ size = 24, strokeWidth = 1.5, ...props }: IconProps) => {
    return (
      <HugeiconsIcon
        icon={icon as never}
        size={size}
        strokeWidth={strokeWidth}
        {...props}
      />
    );
  };

  Icon.displayName = `${iconName}CompatIcon`;
  return Icon;
};

export const AlertCircle = createIcon("AlertCircleIcon");
export const ArrowLeft = createIcon("ArrowLeft01Icon");
export const ArrowRight = createIcon("ArrowRight01Icon");
export const Bell = createIcon("Notification02Icon");
export const BadgeAlertIcon = createIcon("BadgeAlertIcon");
export const CalendarDays = createIcon("Calendar01Icon");
export const Camera = createIcon("Camera01Icon");
export const Check = createIcon("CheckmarkBadge04Icon");
export const CheckCircle2 = createIcon("CheckmarkCircle02Icon");
export const Clock3 = createIcon("Clock03Icon");
export const Copy = createIcon("Copy01Icon");
export const Crosshair = createIcon("Target01Icon");
export const Delete = createIcon("Delete02Icon");
export const Edit = createIcon("Edit02Icon");
export const Film = createIcon("Film01Icon");
export const FileText = createIcon("File01Icon");
export const Filter = createIcon("FilterIcon");
export const Heart = createIcon("FavouriteIcon");
export const House = createIcon("Home03Icon");
export const Image = createIcon("Image01Icon");
export const ImageOff = createIcon("ImageNotFound01Icon");
export const ImagePlus = createIcon("ImageAdd01Icon");
export const Layers3 = createIcon("Layers01Icon");
export const Link2 = createIcon("Link02Icon");
export const ListVideo = createIcon("ListVideoIcon");
export const Loader = createIcon("Loading03Icon");
export const Logout = createIcon("LogoutSquare01Icon");
export const Menu = createIcon("Menu01Icon");
export const More = createIcon("MoreHorizontalCircle01Icon");
export const Comment = createIcon("Comment02Icon");
export const Moon = createIcon("Moon02Icon");
export const PlayCircle = createIcon("PlayIcon");
export const Plus = createIcon("Add01Icon");
export const PlusCircle = createIcon("AddCircleIcon");
export const Search = createIcon("Search01Icon");
export const Security = createIcon("SecurityIcon");
export const Send = createIcon("Send01Icon");
export const Settings = createIcon("Settings03Icon");
export const Share = createIcon("LinkForwardIcon");
export const ShieldAlert = createIcon("Shield01Icon");
export const ShieldCheck = createIcon("Shield02Icon");
export const Sparkles = createIcon("SparklesIcon");
export const Sun = createIcon("Sun02Icon");
export const Tag = createIcon("Tag01Icon");
export const TriangleAlert = createIcon("Alert01Icon");
export const UserCheck = createIcon("UserCheck01Icon");
export const User = createIcon("UserIcon");
export const UserRole = createIcon("UserShield01Icon");
export const UserRoundPlus = createIcon("UserAdd01Icon");
export const UserRoundX = createIcon("UserRemove01Icon");
export const Users = createIcon("UserMultipleIcon");
export const UserX = createIcon("UserRemove01Icon");
export const Video = createIcon("Video02Icon");
export const X = createIcon("Cancel01Icon");
