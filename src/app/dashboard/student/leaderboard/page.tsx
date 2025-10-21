import LeaderboardComponent from '@/app/components/Leaderboard'

export default function StudentLeaderboard() {
  return (
    <div className="p-6">
      <LeaderboardComponent userRole="student" />
    </div>
  )
}