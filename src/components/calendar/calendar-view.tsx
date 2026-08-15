"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import {
  cancelCalendarEvent,
  createCalendarEvent,
  formatCalendarError,
  getCalendarEvent,
  listCalendarConflicts,
  listCalendarEvents,
  listOverdueEvents,
  listUnscheduledEvents,
  listUpcomingEvents,
  updateCalendarEvent,
} from "@/components/calendar/calendar-api";
import { CalendarConflictBanner } from "@/components/calendar/calendar-conflict-banner";
import { CalendarCreateEventDialog } from "@/components/calendar/calendar-create-event-dialog";
import { CalendarEventDetail } from "@/components/calendar/calendar-event-detail";
import { CalendarFiltersBar } from "@/components/calendar/calendar-filters";
import { CalendarListView } from "@/components/calendar/calendar-list-view";
import { CalendarMonthGrid } from "@/components/calendar/calendar-month-grid";
import { CalendarOverduePanel } from "@/components/calendar/calendar-overdue-panel";
import { CalendarUnscheduledQueue } from "@/components/calendar/calendar-unscheduled-queue";
import { CalendarUpcomingPanel } from "@/components/calendar/calendar-upcoming-panel";
import { CalendarWeekGrid } from "@/components/calendar/calendar-week-grid";
import {
  addDays,
  getRangeForView,
  parseDateKey,
  rescheduleEventToDate,
  type CalendarConflict,
  type CalendarEvent,
  type CalendarFilters,
  type CalendarViewMode,
  type CreateCalendarEventInput,
} from "@/components/calendar/types";
import { cn } from "@/lib/utils";

const VIEW_OPTIONS: Array<{ value: CalendarViewMode; label: string }> = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "list", label: "List" },
];

export function CalendarView() {
  const { preference, projects, brands, loading: workspaceLoading, error: workspaceError } =
    useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const workspaceProjectId = preference.currentProjectId;
  const workspaceBrandId = preference.currentBrandId;

  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [filters, setFilters] = useState<CalendarFilters>({
    projectId: workspaceProjectId,
    brandId: workspaceBrandId,
  });

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([]);
  const [overdue, setOverdue] = useState<CalendarEvent[]>([]);
  const [unscheduled, setUnscheduled] = useState<CalendarEvent[]>([]);
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);

  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [overdueLoading, setOverdueLoading] = useState(true);
  const [overdueError, setOverdueError] = useState<string | null>(null);
  const [unscheduledLoading, setUnscheduledLoading] = useState(true);
  const [unscheduledError, setUnscheduledError] = useState<string | null>(null);
  const [conflictsLoading, setConflictsLoading] = useState(true);
  const [conflictsError, setConflictsError] = useState<string | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailActionError, setDetailActionError] = useState<string | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [draggingEvent, setDraggingEvent] = useState<CalendarEvent | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      projectId: current.projectId ?? workspaceProjectId,
      brandId: current.brandId ?? workspaceBrandId,
    }));
  }, [workspaceProjectId, workspaceBrandId]);

  const effectiveFilters = useMemo<CalendarFilters>(
    () => ({
      projectId: filters.projectId ?? workspaceProjectId,
      brandId: filters.brandId ?? workspaceBrandId,
      campaignId: filters.campaignId,
      channel: filters.channel,
      eventType: filters.eventType,
    }),
    [filters, workspaceProjectId, workspaceBrandId],
  );

  const dateRange = useMemo(
    () => getRangeForView(viewMode, anchorDate),
    [viewMode, anchorDate],
  );

  const loadEvents = useCallback(async () => {
    if (!organisationId) {
      setEventsLoading(false);
      return;
    }

    setEventsLoading(true);
    setEventsError(null);
    try {
      const data = await listCalendarEvents(organisationId, {
        from: dateRange.from,
        to: dateRange.to,
        view: viewMode,
        filters: effectiveFilters,
      });
      setEvents(data.items);
    } catch (error) {
      setEvents([]);
      setEventsError(formatCalendarError(error));
    } finally {
      setEventsLoading(false);
    }
  }, [organisationId, dateRange.from, dateRange.to, viewMode, effectiveFilters]);

  const loadSidebar = useCallback(async () => {
    if (!organisationId) {
      setUpcomingLoading(false);
      setOverdueLoading(false);
      setUnscheduledLoading(false);
      setConflictsLoading(false);
      return;
    }

    setUpcomingLoading(true);
    setOverdueLoading(true);
    setUnscheduledLoading(true);
    setConflictsLoading(true);
    setUpcomingError(null);
    setOverdueError(null);
    setUnscheduledError(null);
    setConflictsError(null);

    const results = await Promise.allSettled([
      listUpcomingEvents(organisationId, effectiveFilters),
      listOverdueEvents(organisationId, effectiveFilters),
      listUnscheduledEvents(organisationId, effectiveFilters),
      listCalendarConflicts(organisationId, dateRange.from, dateRange.to, effectiveFilters),
    ]);

    if (results[0].status === "fulfilled") {
      setUpcoming(results[0].value.items);
    } else {
      setUpcoming([]);
      setUpcomingError(formatCalendarError(results[0].reason));
    }
    setUpcomingLoading(false);

    if (results[1].status === "fulfilled") {
      setOverdue(results[1].value.items);
    } else {
      setOverdue([]);
      setOverdueError(formatCalendarError(results[1].reason));
    }
    setOverdueLoading(false);

    if (results[2].status === "fulfilled") {
      setUnscheduled(results[2].value.items);
    } else {
      setUnscheduled([]);
      setUnscheduledError(formatCalendarError(results[2].reason));
    }
    setUnscheduledLoading(false);

    if (results[3].status === "fulfilled") {
      setConflicts(results[3].value.items);
    } else {
      setConflicts([]);
      setConflictsError(formatCalendarError(results[3].reason));
    }
    setConflictsLoading(false);
  }, [organisationId, effectiveFilters, dateRange.from, dateRange.to]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    void loadSidebar();
  }, [loadSidebar]);

  const loadEventDetail = useCallback(
    async (eventId: string) => {
      if (!organisationId) return;
      setDetailLoading(true);
      setDetailError(null);
      setDetailActionError(null);
      try {
        const event = await getCalendarEvent(eventId, organisationId);
        setSelectedEvent(event);
      } catch (error) {
        setSelectedEvent(null);
        setDetailError(formatCalendarError(error));
      } finally {
        setDetailLoading(false);
      }
    },
    [organisationId],
  );

  function handleSelectEvent(event: CalendarEvent) {
    setSelectedEventId(event.id);
    setSelectedEvent(event);
    void loadEventDetail(event.id);
  }

  function handleCloseDetail() {
    setSelectedEventId(null);
    setSelectedEvent(null);
    setDetailError(null);
    setDetailActionError(null);
  }

  async function handleCreateEvent(input: CreateCalendarEventInput) {
    if (!organisationId) return;
    setCreateSaving(true);
    setCreateError(null);
    try {
      const created = await createCalendarEvent(organisationId, {
        ...input,
        projectId: input.projectId ?? effectiveFilters.projectId ?? undefined,
        brandId: input.brandId ?? effectiveFilters.brandId ?? undefined,
      });
      setCreateOpen(false);
      await Promise.all([loadEvents(), loadSidebar()]);
      handleSelectEvent(created);
    } catch (error) {
      setCreateError(formatCalendarError(error));
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleCancelEvent(event: CalendarEvent) {
    if (!organisationId) return;
    setDetailSaving(true);
    setDetailActionError(null);
    try {
      const cancelled = await cancelCalendarEvent(event.id, organisationId);
      setSelectedEvent(cancelled);
      await Promise.all([loadEvents(), loadSidebar()]);
    } catch (error) {
      setDetailActionError(formatCalendarError(error));
    } finally {
      setDetailSaving(false);
    }
  }

  async function handleDropOnDate(dateKey: string) {
    if (!organisationId || !draggingEvent) return;
    const targetDate = parseDateKey(dateKey);
    const nextSchedule = rescheduleEventToDate(draggingEvent, targetDate);

    setRescheduling(true);
    setRescheduleError(null);
    setDropTargetDate(null);
    setDraggingEvent(null);

    try {
      await updateCalendarEvent(draggingEvent.id, organisationId, {
        startsAt: nextSchedule.startsAt,
        endsAt: nextSchedule.endsAt,
        version: draggingEvent.version,
      });
      await Promise.all([loadEvents(), loadSidebar()]);
    } catch (error) {
      setRescheduleError(formatCalendarError(error));
    } finally {
      setRescheduling(false);
    }
  }

  function shiftAnchor(direction: -1 | 1) {
    setAnchorDate((current) => {
      if (viewMode === "week") return addDays(current, direction * 7);
      if (viewMode === "list") return addDays(current, direction * 30);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  }

  const defaultTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  }, []);

  if (workspaceLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-600">
          Loading workspace…
        </CardContent>
      </Card>
    );
  }

  if (workspaceError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-red-600">{workspaceError}</CardContent>
      </Card>
    );
  }

  if (!organisationId) {
    return (
      <>
        <PageHeader
          title="Content Calendar"
          description="Plan campaigns and coordinate publishing schedules across channels."
          breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Content Calendar" }]}
        />
        <Card>
          <CardContent className="py-8 text-center text-sm text-slate-600">
            Select an organisation workspace to view the content calendar.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Calendar"
        description="Plan campaigns and coordinate publishing schedules across channels."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Content Calendar" }]}
        actions={
          <Button onClick={() => setCreateOpen(true)}>New event</Button>
        }
      />

      <CalendarConflictBanner
        conflicts={conflicts}
        loading={conflictsLoading}
        error={conflictsError}
      />

      <CalendarFiltersBar
        organisationId={organisationId}
        projects={projects}
        brands={brands}
        filters={filters}
        onChange={setFilters}
      />

      <div className="flex flex-wrap gap-2">
        {VIEW_OPTIONS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={viewMode === option.value ? "primary" : "outline"}
            onClick={() => setViewMode(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {rescheduleError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{rescheduleError}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className={cn(eventsLoading && "opacity-70")}>
          {eventsLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-slate-600">
                Loading calendar events…
              </CardContent>
            </Card>
          ) : eventsError ? (
            <Card>
              <CardContent className="space-y-3 py-8 text-center">
                <p className="text-sm text-red-600">{eventsError}</p>
                <Button variant="outline" size="sm" onClick={() => void loadEvents()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === "month" ? (
            <CalendarMonthGrid
              anchorDate={anchorDate}
              events={events}
              draggingEventId={draggingEvent?.id}
              dropTargetDate={dropTargetDate}
              rescheduling={rescheduling}
              onPrevious={() => shiftAnchor(-1)}
              onNext={() => shiftAnchor(1)}
              onToday={() => setAnchorDate(new Date())}
              onSelectEvent={handleSelectEvent}
              onDragStart={setDraggingEvent}
              onDragEnd={() => {
                setDraggingEvent(null);
                setDropTargetDate(null);
              }}
              onDropOnDate={(dateKey) => void handleDropOnDate(dateKey)}
              onDragOverDate={setDropTargetDate}
            />
          ) : viewMode === "week" ? (
            <CalendarWeekGrid
              anchorDate={anchorDate}
              events={events}
              draggingEventId={draggingEvent?.id}
              dropTargetDate={dropTargetDate}
              rescheduling={rescheduling}
              onPrevious={() => shiftAnchor(-1)}
              onNext={() => shiftAnchor(1)}
              onToday={() => setAnchorDate(new Date())}
              onSelectEvent={handleSelectEvent}
              onDragStart={setDraggingEvent}
              onDragEnd={() => {
                setDraggingEvent(null);
                setDropTargetDate(null);
              }}
              onDropOnDate={(dateKey) => void handleDropOnDate(dateKey)}
              onDragOverDate={setDropTargetDate}
            />
          ) : (
            <CalendarListView
              anchorDate={anchorDate}
              events={events}
              onPrevious={() => shiftAnchor(-1)}
              onNext={() => shiftAnchor(1)}
              onToday={() => setAnchorDate(new Date())}
              onSelectEvent={handleSelectEvent}
            />
          )}
        </div>

        <aside className="space-y-4">
          <CalendarUpcomingPanel
            events={upcoming}
            loading={upcomingLoading}
            error={upcomingError}
            onSelectEvent={handleSelectEvent}
          />
          <CalendarOverduePanel
            events={overdue}
            loading={overdueLoading}
            error={overdueError}
            onSelectEvent={handleSelectEvent}
          />
          <CalendarUnscheduledQueue
            events={unscheduled}
            loading={unscheduledLoading}
            error={unscheduledError}
            onSelectEvent={handleSelectEvent}
          />
        </aside>
      </div>

      <CalendarEventDetail
        event={selectedEvent}
        open={selectedEventId !== null}
        loading={detailLoading}
        error={detailError}
        actionError={detailActionError}
        saving={detailSaving}
        onClose={handleCloseDetail}
        onCancel={(event) => void handleCancelEvent(event)}
        onRefresh={(event) => void loadEventDetail(event.id)}
      />

      <CalendarCreateEventDialog
        open={createOpen}
        organisationId={organisationId}
        defaultProjectId={effectiveFilters.projectId}
        defaultBrandId={effectiveFilters.brandId}
        defaultTimezone={defaultTimezone}
        saving={createSaving}
        error={createError}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
        onSubmit={(input) => void handleCreateEvent(input)}
      />
    </div>
  );
}
