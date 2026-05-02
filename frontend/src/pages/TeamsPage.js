import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [name, setName] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamDetail, setTeamDetail] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const loadTeams = async () => {
    const res = await api.get("/teams");
    setTeams(res.data);
    if (!selectedTeamId && res.data.length) setSelectedTeamId(res.data[0].team_id);
  };

  const loadDetail = async (teamId) => {
    if (!teamId) return;
    const res = await api.get(`/teams/${teamId}`);
    setTeamDetail(res.data);
  };

  useEffect(() => {
    loadTeams().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTeamId) { setTeamDetail(null); return; }
    loadDetail(selectedTeamId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTeamId]);

  const yourRole = teamDetail?.your_role || "member";
  const isAdmin  = yourRole === "owner" || yourRole === "admin";

  // Stable reference — fixes react-hooks/exhaustive-deps ESLint CI error
  const members      = useMemo(() => teamDetail?.members || [], [teamDetail]);
  const invitedCount = useMemo(() => members.filter((m) => m.status === "invited").length, [members]);

  const createTeam = async () => {
    if (!name.trim()) return;
    const res = await api.post("/teams", { name: name.trim() });
    setName("");
    setTeams((p) => [res.data, ...p]);
    setSelectedTeamId(res.data.team_id);
  };

  const addMember = async () => {
    if (!inviteEmail.trim()) return;
    const res = await api.post(`/teams/${selectedTeamId}/members`, {
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    });
    setInviteEmail("");
    setInviteRole("member");
    setTeamDetail((prev) => ({ ...prev, members: [res.data, ...(prev?.members || [])] }));
  };

  const updateMemberRole = async (memberId, role) => {
    const res = await api.put(`/teams/${selectedTeamId}/members/${memberId}`, { role });
    setTeamDetail((prev) => ({
      ...prev,
      members: (prev?.members || []).map((m) => (m.member_id === memberId ? res.data : m)),
    }));
  };

  const removeMember = async (memberId) => {
    if (!window.confirm("Remove this member?")) return;
    await api.delete(`/teams/${selectedTeamId}/members/${memberId}`);
    setTeamDetail((prev) => ({
      ...prev,
      members: (prev?.members || []).filter((m) => m.member_id !== memberId),
    }));
  };

  return (
    <div data-testid="teams-page" className="space-y-6">
      <div>
        <div data-testid="teams-title" className="text-sm font-semibold">Teams</div>
        <div data-testid="teams-subtitle" className="mt-1 text-sm text-muted-foreground">
          Create teams, add admins, and assign tasks to people.
        </div>
      </div>

      <div data-testid="teams-create" className="rounded-3xl border border-border/70 bg-card/50 p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
          <Input data-testid="teams-create-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name (e.g., Product)" />
          <Button data-testid="teams-create-button" onClick={createTeam}>Create team</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div data-testid="teams-list" className="rounded-3xl border border-border/70 bg-card/50 overflow-hidden">
            {teams.length === 0 ? (
              <div data-testid="teams-empty" className="px-5 py-8 text-sm text-muted-foreground">No teams yet.</div>
            ) : (
              teams.map((t) => (
                <button
                  key={t.team_id}
                  data-testid={`team-row-${t.team_id}`}
                  onClick={() => setSelectedTeamId(t.team_id)}
                  className={
                    "w-full px-5 py-4 text-left border-b border-border/40 transition-colors duration-150 " +
                    (selectedTeamId === t.team_id ? "bg-violet-500/10" : "hover:bg-muted/40")
                  }
                >
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.team_id}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-8">
          <div data-testid="team-detail" className="rounded-3xl border border-border/70 bg-card/50 p-6">
            {!selectedTeamId ? (
              <div data-testid="team-detail-empty" className="text-sm text-muted-foreground">Select a team.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div data-testid="team-detail-title" className="text-sm font-semibold">
                      {teamDetail?.team?.name || "Team"}
                    </div>
                    <div data-testid="team-detail-role" className="mt-1 text-sm text-muted-foreground">
                      Your role: <span className="font-medium text-foreground">{yourRole}</span>
                      {invitedCount ? <span className="ml-2">• Invites pending: {invitedCount}</span> : null}
                    </div>
                  </div>
                  <Badge data-testid="team-detail-badge" tone={isAdmin ? "info" : "neutral"}>
                    {isAdmin ? "Admin" : "Member"}
                  </Badge>
                </div>

                <div className="mt-6">
                  <div data-testid="team-members-title" className="text-sm font-semibold">Members</div>
                  <div data-testid="team-members-subtitle" className="mt-1 text-sm text-muted-foreground">
                    Add members by email. Invites become active when they sign in.
                  </div>

                  <div data-testid="team-members-add" className="mt-4 rounded-2xl border border-border/60 bg-background/30 p-4">
                    {!isAdmin ? (
                      <div data-testid="team-members-add-disabled" className="text-sm text-muted-foreground">
                        Only team admins can add or change members.
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
                        <Input data-testid="team-invite-email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="member@company.com" />
                        <Select
                          data-testid="team-invite-role"
                          value={inviteRole}
                          onChange={setInviteRole}
                          options={[{ value: "member", label: "Member" }, { value: "admin", label: "Admin" }]}
                        />
                        <Button data-testid="team-invite-button" onClick={addMember}>Add</Button>
                      </div>
                    )}
                  </div>

                  <div data-testid="team-members-list" className="mt-4 rounded-2xl border border-border/60 overflow-hidden">
                    {members.length === 0 ? (
                      <div data-testid="team-members-empty" className="px-4 py-6 text-sm text-muted-foreground">No members found.</div>
                    ) : (
                      members.map((m) => (
                        <div
                          key={m.member_id}
                          data-testid={`team-member-${m.member_id}`}
                          className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{m.email}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {m.status}{m.user_id ? " • active" : ""}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Select
                              data-testid={`team-member-role-${m.member_id}`}
                              value={m.role}
                              onChange={(role) => updateMemberRole(m.member_id, role)}
                              options={[{ value: "member", label: "Member" }, { value: "admin", label: "Admin" }, { value: "owner", label: "Owner" }]}
                              disabled={!isAdmin}
                              className="max-w-[160px]"
                            />
                            <Button
                              data-testid={`team-member-remove-${m.member_id}`}
                              variant="ghost"
                              onClick={() => removeMember(m.member_id)}
                              disabled={!isAdmin}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div data-testid="teams-permissions-note" className="mt-4 text-xs text-muted-foreground">
                    Admins can add members and assign tasks. Ownership can be transferred by setting another member to Owner.
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
