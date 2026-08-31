// Generic instant loader for every /app page that fetches on the server (Meta/DB/AI reads can take a few
// seconds cold). Rendered by each route's loading.tsx so navigation is never a frozen blank - the app always
// shows structured, animated placeholders while the real content resolves. Neutral by design so it fits any
// screen (cockpit has its own tailored skeleton).

function Bar({ w, h = 14 }: { w: string; h?: number }) {
  return <div className="animate-pulse rounded-md bg-[var(--surface-alt)]" style={{ width: w, height: h }} />;
}
function Card({ children }: { children?: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">{children}</div>;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Bar w="200px" h={12} />
        <Bar w="300px" h={26} />
      </div>
      <Card>
        <div className="space-y-3">
          <Bar w="180px" />
          <Bar w="80%" h={10} />
          <Bar w="65%" h={10} />
          <Bar w="72%" h={10} />
        </div>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <div className="space-y-4">
              <Bar w="50%" />
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="space-y-2 border-t border-[var(--surface-alt)] pt-3 first:border-t-0 first:pt-0">
                  <Bar w="70%" h={12} />
                  <Bar w="35%" h={8} />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
