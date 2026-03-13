"use client";

import React from "react";

export function SkeletonTweet({ withMedia = false }: { withMedia?: boolean }) {
  return (
    <div className="tweet" style={{ cursor: "default" }}>
      <div className="skeleton skeleton-circle" style={{ width: 36, height: 36 }} />
      <div className="tweet-body">
        <div className="tweet-header" style={{ marginBottom: 10 }}>
          <div className="skeleton" style={{ height: 12, width: "34%" }} />
          <div className="skeleton" style={{ height: 12, width: "18%" }} />
          <div className="skeleton" style={{ height: 12, width: "14%" }} />
        </div>
        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <div className="skeleton" style={{ height: 12, width: "92%" }} />
          <div className="skeleton" style={{ height: 12, width: "86%" }} />
          <div className="skeleton" style={{ height: 12, width: "62%" }} />
        </div>
        {withMedia ? <div className="skeleton" style={{ height: 180, width: "100%", borderRadius: 12 }} /> : null}
        <div className="tweet-actions" style={{ marginTop: 10 }}>
          <div className="skeleton" style={{ height: 12, width: 54 }} />
          <div className="skeleton" style={{ height: 12, width: 54 }} />
          <div className="skeleton" style={{ height: 12, width: 54 }} />
          <div className="skeleton" style={{ height: 12, width: 34 }} />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTweetList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonTweet key={idx} withMedia={idx % 3 === 0} />
      ))}
    </>
  );
}

export function SkeletonWidget({ rows = 3 }: { rows?: number }) {
  return (
    <div className="widget">
      <div className="widget-title">
        <span className="skeleton" style={{ display: "inline-block", height: 14, width: 120, borderRadius: 10 }} />
      </div>
      {Array.from({ length: rows }).map((_, idx) => (
        <div key={idx} className="trend-item" style={{ cursor: "default" }}>
          <div className="skeleton" style={{ height: 10, width: "45%", marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 12, width: "70%", marginBottom: 6 }} />
          <div className="skeleton" style={{ height: 10, width: "35%" }} />
        </div>
      ))}
    </div>
  );
}

