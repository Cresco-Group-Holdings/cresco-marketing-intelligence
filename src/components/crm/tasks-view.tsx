"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type TasksViewMode = "tasks" | "my" | "overdue" | "activities" | "followUps";

type Props = { mode: TasksViewMode };

export function TasksView({ mode }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/crm/tasks` : null;

  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([]);
  const [activities, setActivities] = useState<Array<Record<string, unknown>>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [suggestions, setSuggestions] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("FOLLOW_UP");
  const [dueDate, setDueDate] = useState("");
  const [leadId, setLeadId] = useState("");
  const [opportunityId, setOpportunityId] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityType, setActivityType] = useState("NOTE");
  const [activitySummary, setActivitySummary] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleTrigger, setRuleTrigger] = useState("QUALIFIED_LEAD_NO_TASK");
  const [aiConsent, setAiConsent] = useState(false);

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "tasks") {
        const res = await apiFetch<{ tasks: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}`);
        setTasks(res.tasks);
      } else if (mode === "my") {
        const res = await apiFetch<{ tasks: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}&view=my`);
        setTasks(res.tasks);
      } else if (mode === "overdue") {
        const res = await apiFetch<{ tasks: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}&view=overdue`);
        setTasks(res.tasks);
      } else if (mode === "activities") {
        const res = await apiFetch<{ activities: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}&view=activities`);
        setActivities(res.activities);
      } else if (mode === "followUps") {
        const res = await apiFetch<{ rules: Array<Record<string, unknown>>; suggestions: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=follow-ups`,
        );
        setRules(res.rules);
        setSuggestions(res.suggestions);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode]);

  useEffect(() => { loadData(); }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, { method: "POST", body: JSON.stringify(body) });
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const nav = (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link href="/crm/tasks" className={`rounded-md px-3 py-1.5 text-sm ${mode === "tasks" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>All tasks</Link>
      <Link href="/crm/tasks/my" className={`rounded-md px-3 py-1.5 text-sm ${mode === "my" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>My tasks</Link>
      <Link href="/crm/tasks/overdue" className={`rounded-md px-3 py-1.5 text-sm ${mode === "overdue" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Overdue</Link>
      <Link href="/crm/activities" className={`rounded-md px-3 py-1.5 text-sm ${mode === "activities" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Activities</Link>
      <Link href="/crm/follow-ups" className={`rounded-md px-3 py-1.5 text-sm ${mode === "followUps" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Follow-ups</Link>
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="CRM Tasks & Follow-ups" description="Assign, track, and complete follow-up work for leads and opportunities." />
      {nav}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {(mode === "tasks" || mode === "my" || mode === "overdue") && (
        <div className="space-y-4">
          {mode === "tasks" && (
            <Card>
              <CardHeader><CardTitle>Create task</CardTitle></CardHeader>
              <CardContent className="space-y-3 max-w-lg">
                <Input label="Title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Follow up with lead" />
                <Input label="Type" value={taskType} onChange={(e) => setTaskType(e.target.value)} placeholder="FOLLOW_UP" />
                <Input label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} placeholder="2026-08-01" />
                <Input label="Lead ID (optional)" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
                <Input label="Opportunity ID (optional)" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} />
                <Button onClick={() => postAction({ action: "createTask", title: taskTitle, taskTypeCode: taskType, dueDate: dueDate || undefined, leadId: leadId || undefined, opportunityId: opportunityId || undefined })}>Create task</Button>
              </CardContent>
            </Card>
          )}
          <div className="space-y-2">
            {tasks.map((t) => (
              <Card key={String(t.id)}>
                <CardContent className="flex justify-between py-4">
                  <div>
                    <p className="font-medium">{String(t.title)}</p>
                    <p className="text-sm text-muted-foreground">{String(t.taskTypeCode)} · {(t.owner as Record<string, unknown>)?.displayName as string ?? "Unassigned"}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant={String(t.displayStatus ?? t.status) === "OVERDUE" ? "default" : "muted"}>{String(t.displayStatus ?? t.status)}</Badge>
                    {t.dueDate ? <Badge variant="muted">{new Date(String(t.dueDate)).toLocaleDateString()}</Badge> : null}
                    {["OPEN", "IN_PROGRESS", "OVERDUE"].includes(String(t.status)) ? (
                      <Button size="sm" variant="outline" onClick={() => postAction({ action: "completeTask", taskId: t.id, outcome: "Completed" })}>Complete</Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks found.</p>}
          </div>
        </div>
      )}

      {mode === "activities" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Log activity</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Type" value={activityType} onChange={(e) => setActivityType(e.target.value)} placeholder="CALL, EMAIL, MEETING, NOTE" />
              <Input label="Title" value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} />
              <Input label="Summary" value={activitySummary} onChange={(e) => setActivitySummary(e.target.value)} />
              <Input label="Lead ID (optional)" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
              <Input label="Opportunity ID (optional)" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} />
              <Button onClick={() => postAction({ action: "logActivity", activityType, title: activityTitle, summary: activitySummary, leadId: leadId || undefined, opportunityId: opportunityId || undefined, noteContent: activityType === "NOTE" ? activitySummary : undefined })}>Log activity</Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {activities.map((a) => (
              <Card key={String(a.id)}>
                <CardContent className="py-4">
                  <div className="flex justify-between">
                    <p className="font-medium">{String(a.title)}</p>
                    <Badge variant="muted">{String(a.activityType)}</Badge>
                  </div>
                  {a.summary ? <p className="text-sm text-muted-foreground mt-1">{String(a.summary)}</p> : null}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(String(a.occurredAt)).toLocaleString()} · {(a.loggedBy as Record<string, unknown>)?.displayName as string}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {mode === "followUps" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Follow-up rules</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Rule name" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
              <Input label="Trigger" value={ruleTrigger} onChange={(e) => setRuleTrigger(e.target.value)} placeholder="QUALIFIED_LEAD_NO_TASK" />
              <div className="flex gap-2">
                <Button onClick={() => postAction({ action: "createFollowUpRule", name: ruleName, trigger: ruleTrigger })}>Create rule</Button>
                <Button variant="outline" onClick={() => postAction({ action: "evaluateFollowUpRules" })}>Evaluate rules</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>AI follow-up assistant</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
                Consent to use CRM evidence for AI suggestions (no auto-send)
              </label>
              <Input label="Lead ID" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
              <Input label="Opportunity ID" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} />
              <Button disabled={!aiConsent} onClick={() => postAction({ action: "generateAiSuggestion", leadId: leadId || undefined, opportunityId: opportunityId || undefined, consentGranted: aiConsent })}>Generate suggestion</Button>
            </CardContent>
          </Card>
          {rules.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Active rules</h3>
              {rules.map((r) => (
                <Card key={String(r.id)}><CardContent className="py-3 text-sm">{String(r.name)} — {String(r.trigger)}</CardContent></Card>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Pending suggestions</h3>
            {suggestions.map((s) => (
              <Card key={String(s.id)}>
                <CardContent className="py-4">
                  <p className="font-medium">{String(s.title)}</p>
                  {s.description ? <p className="text-sm text-muted-foreground mt-1">{String(s.description)}</p> : null}
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => postAction({ action: "acceptSuggestion", suggestionId: s.id })}>Accept → create task</Button>
                    <Button size="sm" variant="outline" onClick={() => postAction({ action: "dismissSuggestion", suggestionId: s.id })}>Dismiss</Button>
                    {s.autoSendBlocked ? <Badge variant="muted">No auto-send</Badge> : null}
                  </div>
                </CardContent>
              </Card>
            ))}
            {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No pending suggestions.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
