import LeaderboardComponent from '@/app/components/Leaderboard'

export default function Leaderboard() {
  return (
    <div className="p-6">
      <LeaderboardComponent userRole="admin" />
    </div>
  )
}