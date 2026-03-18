import { Card } from './ui/Card'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { ActivityItem } from '@/types'
import { Receipt, CreditCard, Users, CheckCircle2 } from 'lucide-react'

interface ActivityViewProps {
  activities: ActivityItem[]
}

export function ActivityView({ activities }: ActivityViewProps) {
  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'expense': return <Receipt size={18} className="text-teal" />
      case 'payment': return <CreditCard size={18} className="text-teal" />
      case 'group_created': return <Users size={18} className="text-teal" />
      case 'settle_all': return <CheckCircle2 size={18} className="text-teal" />
    }
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <h2 className="text-lg font-semibold text-charcoal">Recent Activity</h2>
      <Card className="divide-y divide-gray-100">
        {activities.map(activity => (
          <div key={activity.id} className="flex items-start gap-3 p-4">
            <div className="mt-0.5 p-2 rounded-full bg-teal-light">
              {getIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-charcoal">{activity.description}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-charcoal-light">{formatDate(activity.date)}</p>
                {activity.amount != null && activity.amount > 0 && (
                  <span className="text-xs font-medium text-teal">
                    {formatCurrency(activity.amount, activity.currency)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {activities.length === 0 && (
          <p className="text-center text-charcoal-light py-8 text-sm">No activity yet</p>
        )}
      </Card>
    </div>
  )
}
