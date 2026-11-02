import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

// Fixed demo figures in millions of VND. Deliberately not randomised: a chart
// that changes on every render makes a demo look broken.
const data = [
  { name: 'T1', total: 1820 },
  { name: 'T2', total: 1460 },
  { name: 'T3', total: 2130 },
  { name: 'T4', total: 1975 },
  { name: 'T5', total: 2480 },
  { name: 'T6', total: 2210 },
  { name: 'T7', total: 2890 },
  { name: 'T8', total: 2640 },
  { name: 'T9', total: 3120 },
  { name: 'T10', total: 3380 },
  { name: 'T11', total: 2950 },
  { name: 'T12', total: 3610 },
]

export function VolumeChart() {
  return (
    <ResponsiveContainer width='100%' height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey='name'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `${value} tr`}
        />
        <Bar
          dataKey='total'
          fill='currentColor'
          radius={[4, 4, 0, 0]}
          className='fill-primary'
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
