import { Link } from 'react-router-dom'

export default function Adresses() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Link to="/" className="text-primary hover:underline mb-6 block">← Back</Link>
        <h1 className="text-4xl font-bold text-foreground">Adresses</h1>
        <p className="mt-4 text-muted-foreground">Manage your addresses</p>
      </div>
    </div>
  )
}
