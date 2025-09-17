import { useMemberships } from "../hooks/useMemberships";
import { Membership } from "@autumn/shared";
import { PageSectionHeader } from "@/components/general/PageSectionHeader";
import { Item, Row } from "@/components/general/TableGrid";
import { cn } from "@/lib/utils";
import { formatDateStr } from "@/utils/formatUtils/formatDateUtils";
import { Badge } from "@/components/ui/badge";
import { InvitePopover } from "./InvitePopover";
import { useSession } from "@/lib/auth-client";
import { MemberRowToolbar } from "./MemberRowToolbar";

export const OrgMembersList = () => {
  const { memberships, isLoading: isMembersLoading } = useMemberships();
  const { data } = useSession();

  if (isMembersLoading) return null;

  const membership = memberships.find(
    (membership: Membership) => membership.user.id === data?.session?.userId,
  );

  const isAdmin =
    membership?.member.role === "admin" || membership?.member.role === "owner";

  return (
    <div className="h-full overflow-y-auto">
      {/* <PageSectionHeader
        title="Members"
        isOnboarding={true}
        className="px-6"
        classNames={{
          title: "text-t3",
        }}
        addButton={<InvitePopover />}
      /> */}

      <Row type="header" className="flex px-6">
        <Item className="flex-[6]">Email</Item>
        <Item className="flex-[5.1]">Name</Item>
        <Item className="flex-[2.6]">Role</Item>
        {/* <Item className="col-span-0"></Item> */}
        <Item className="flex-[3]">Created At</Item>
        <Item className="flex-[1]"></Item>
      </Row>
      {memberships.map((membership: Membership) => {
        const user = membership.user;
        const member = membership.member;
        return (
          <Row
            key={membership.user.id}
            className="flex px-6 text-sm text-t2"
          >
            <Item className="flex-[6]">{user.email}</Item>
            <Item className="flex-[4.7]">{user.name}</Item>
            <Item className="flex-[3]">
              <Badge variant="outline">{member.role}</Badge>
            </Item>
            {/* <Item className="col-span-0"></Item> */}
            <Item className="flex-[3]">
              {formatDateStr(member.createdAt)}
            </Item>
            <Item className="flex-[1] flex justify-end">
              {isAdmin && <MemberRowToolbar membership={membership} />}
            </Item>
          </Row>
        );
      })}
    </div>
  );
};
