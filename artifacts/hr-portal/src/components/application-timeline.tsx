import { CheckCircle2, Circle, XCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  WORKFLOW_STAGES,
  STAGE_COLOR_MAP,
  TERMINAL_STATUSES,
  getActiveStageIndex,
  isStageComplete,
  isStageCurrent,
} from "@/lib/workflowStages";

interface ApplicationTimelineProps {
  status: string;
}

export function ApplicationTimeline({ status }: ApplicationTimelineProps) {
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const activeIndex = getActiveStageIndex(status);

  if (isTerminal) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          {status === "rejected" ? (
            <XCircle className="h-5 w-5 text-destructive shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {status === "rejected" ? "Application Unsuccessful" : "Application Withdrawn"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status === "rejected"
                ? "Thank you for applying. Unfortunately your application was not successful at this time."
                : "This application has been withdrawn from the recruitment process."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Your journey — Step {activeIndex + 1} of {WORKFLOW_STAGES.length}
      </p>
      <div className="relative">
        {WORKFLOW_STAGES.map((stage, i) => {
          const complete = isStageComplete(i, activeIndex);
          const current = isStageCurrent(i, activeIndex);
          const future = !complete && !current;
          const colors = STAGE_COLOR_MAP[stage.color];
          const Icon = stage.icon;

          return (
            <div key={stage.id} className="flex gap-3 relative">
              <div className="flex flex-col items-center">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 transition-all ${
                    complete
                      ? "bg-primary border-primary"
                      : current
                      ? `${colors.bg} ${colors.border} ring-2 ${colors.ring}`
                      : "bg-background border-border"
                  }`}
                >
                  {complete ? (
                    <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                  ) : current ? (
                    <Icon className={`h-3.5 w-3.5 ${colors.text}`} />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                </div>
                {i < WORKFLOW_STAGES.length - 1 && (
                  <div className={`w-0.5 flex-1 min-h-[2rem] my-0.5 ${complete ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
              <div className={`pb-4 flex-1 ${i === WORKFLOW_STAGES.length - 1 ? "pb-0" : ""}`}>
                <div className="flex items-center gap-2 pt-1">
                  <p
                    className={`text-sm font-medium ${
                      complete ? "text-foreground" : current ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </p>
                  {current && (
                    <Badge
                      className={`text-xs px-1.5 py-0 ${colors.bg} ${colors.text} border ${colors.border}`}
                      variant="outline"
                    >
                      Current
                    </Badge>
                  )}
                </div>
                {(current || future) && (
                  <p className={`text-xs mt-0.5 ${current ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    {stage.description}
                  </p>
                )}
                {current && (
                  <p className={`text-xs mt-1 font-medium ${colors.text}`}>Expected: {stage.timeframe}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
