import type { PublishFailure, PublishProgress, PublishResult } from "./usePublish";

// what publishing is doing now, or how it ended: progress, the finished count, or where it stopped
export function PublishStatus({
  progress,
  result,
  failure,
  retryInSeconds,
  onDismiss,
}: {
  progress: PublishProgress | null;
  result: PublishResult | null;
  failure: PublishFailure | null;
  retryInSeconds: number | null;
  onDismiss: () => void;
}) {
  if (progress) {
    return (
      <div className="publish-status" role="status">
        <p className="publish-status-line">
          <span>
            Publishing {progress.done} of {progress.total}
          </span>
          <span className="text-muted">Keep this page open</span>
        </p>
        <progress
          max={progress.total}
          value={progress.done}
          aria-label="Lists published"
        />
      </div>
    );
  }

  if (failure) {
    return (
      <div className="error" role="alert">
        <p className="m-0 font-semibold">
          {failure.done} of {failure.total} lists are on Moxfield
          {failure.entryName ? `. Stopped at ${failure.entryName}.` : "."}
        </p>
        <p className="mb-0">{failure.message}</p>
        {retryInSeconds !== null ? (
          <p className="mb-0 mt-2 tabular-nums">Publish is available again in {retryInSeconds}s.</p>
        ) : null}
      </div>
    );
  }

  if (result) {
    return (
      <div className="success flex items-center justify-between gap-3" role="status">
        <span>
          Done: {result.count} {result.count === 1 ? "list" : "lists"} published to Moxfield.
        </span>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
