import { AppShell } from "@/components/AppShell";

export default function MessagesPage() {
  return (
    <AppShell>
      <div className="feed-header">
        <div className="tab-bar">
          <div className="tab active">Messages</div>
        </div>
      </div>

      <div className="tweet" style={{ cursor: "default" }}>
        <div className="avatar av-cream">..</div>
        <div className="tweet-body">
          <div className="tweet-header">
            <span className="tweet-name">Messages</span>
            <span className="tweet-handle">coming soon</span>
          </div>
          <div className="tweet-text">Direct messages will appear here.</div>
        </div>
      </div>
    </AppShell>
  );
}
