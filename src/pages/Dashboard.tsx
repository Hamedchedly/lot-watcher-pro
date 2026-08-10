import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-4 text-muted-foreground">Welcome to Lot Watcher Pro - SPA Edition</p>
        <div className="mt-8 space-y-2">
          <Link to="/adresses" className="block text-primary hover:underline">
            → Adresses
          </Link>
          <Link to="/import" className="block text-primary hover:underline">
            → Import
          </Link>
          <Link to="/import-travaux" className="block text-primary hover:underline">
            → Import Travaux
          </Link>
        </div>
      </div>
    </div>
  )
}
