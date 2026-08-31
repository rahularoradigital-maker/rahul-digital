// Shown INSTANTLY on every /app navigation while the page's server component resolves
// its data (the Meta pull can take a few seconds on a cold cache). This turns a frozen
// blank wait into an immediate, structured skeleton, so the app always feels responsive.

function Bar({ w, h = 14 }: { w: string; h?: number }) {
  return <div className="animate-pulse rounded-md bg-[var(--surface-alt)]" style={{ width: w, height: h }} />;
}

function Card({ children }: { children?: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm p-6">{children}</div>;
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Bar w="220px" h={12} />
        <Bar w="320px" h={26} />
      </div>

      <Card>
        <div className="flex items-center gap-8">
          <div className="h-[150px] w-[150px] shrink-0 animate-pulse rounded-full border-[10px] border-[var(--surface-alt)]" />
          <div className="flex-1 space-y-3">
            <Bar w="160px" />
            <Bar w="70%" h={10} />
            <Bar w="55%" h={10} />
            <Bar w="60%" h={10} />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="space-y-3">
              <Bar w="60%" h={11} />
              <Bar w="45%" h={22} />
              <Bar w="80%" h={10} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card>
          <div className="space-y-4">
            <Bar w="180px" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 border-t border-[var(--surface-alt)] pt-3 first:border-t-0 first:pt-0">
                <Bar w="70%" h={12} />
                <Bar w="30%" h={8} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="space-y-4">
            <Bar w="60%" />
            {[0, 1, 2, 3].map((i) => (
              <Bar key={i} w="100%" h={10} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
