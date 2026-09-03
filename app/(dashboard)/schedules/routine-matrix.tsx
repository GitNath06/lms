'use client'

import React from 'react'

const TIME_SLOTS = [
  { id: 't1', label: '9:15-10:00', name: 'Pre-Period' },
  { id: 't2', label: '10:10-11:00', name: 'Period 1' },
  { id: 't3', label: '11:00-11:45', name: 'Period 2' },
  { id: 't4', label: '11:45-12:30', name: 'Period 3' },
  { id: 't5', label: '12:30-1:15', name: 'Period 4' },
  { id: 't6', label: '1:15-1:45', name: 'Break' },
  { id: 't7', label: '1:45-2:30', name: 'Period 5' },
  { id: 't8', label: '2:30-3:15', name: 'Period 6' },
  { id: 't9', label: '3:15-4:05', name: 'Period 7' },
  { id: 't10', label: '4:05-4:50', name: 'Period 8' },
]

const DAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tues' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thurs' },
  { id: 'fri', label: 'Fri' },
]

// Mock data matching the user's screenshot
const MOCK_SCHEDULES = [
  { day: 'mon', slot: 't2', subject: 'Pr(Computer-12)', span: 2, color: 'bg-blue-200 text-blue-900 border-blue-300' },
  { day: 'mon', slot: 't4', subject: 'Pr(Physics-12)', span: 1, color: 'bg-blue-200 text-blue-900 border-blue-300' },
  { day: 'mon', slot: 't5', subject: 'Pr(Physics-12)\nPr(Computer C- 7)', span: 1, color: 'bg-blue-200 text-blue-900 border-blue-300' },
  { day: 'mon', slot: 't6', subject: 'Pr(JAVA)', span: 1, color: 'bg-blue-200 text-blue-900 border-blue-300' },
  { day: 'mon', slot: 't7', subject: 'Pr(DBMS-10)', span: 1, color: 'bg-blue-200 text-blue-900 border-blue-300' },
  { day: 'mon', slot: 't8', subject: 'Pr(WMAD/OS-11)', span: 2, color: 'bg-blue-200 text-blue-900 border-blue-300' },
  { day: 'mon', slot: 't10', subject: 'Pr(CP-9)', span: 1, color: 'bg-blue-200 text-blue-900 border-blue-300' },
  
  { day: 'tue', slot: 't2', subject: 'Pr(DDMP-10)\nPr(Chemistry-12)', span: 1, color: 'bg-orange-200 text-orange-900 border-orange-300' },
  { day: 'tue', slot: 't3', subject: 'Pr(Chemistry-12)', span: 2, color: 'bg-orange-200 text-orange-900 border-orange-300' },
  { day: 'tue', slot: 't5', subject: 'Pr(Computer A/B-7)', span: 2, color: 'bg-orange-200 text-orange-900 border-orange-300' },
  { day: 'tue', slot: 't7', subject: 'Pr(DBMS-10)', span: 1, color: 'bg-orange-200 text-orange-900 border-orange-300' },
  { day: 'tue', slot: 't8', subject: 'Pr(COA-11)', span: 1, color: 'bg-orange-200 text-orange-900 border-orange-300' },
  { day: 'tue', slot: 't9', subject: 'Pr(VP-12)', span: 1, color: 'bg-orange-200 text-orange-900 border-orange-300' },
  { day: 'tue', slot: 't10', subject: 'Pr(CP-9)', span: 1, color: 'bg-orange-200 text-orange-900 border-orange-300' },
  
  { day: 'wed', slot: 't2', subject: 'Pr(DDMP-10)', span: 1, color: 'bg-slate-300 text-slate-900 border-slate-400' },
  { day: 'wed', slot: 't3', subject: 'Pr(OS/Chemistry-11)', span: 2, color: 'bg-slate-300 text-slate-900 border-slate-400' },
  { day: 'wed', slot: 't5', subject: 'Pr(FES-9)', span: 2, color: 'bg-slate-300 text-slate-900 border-slate-400' },
  { day: 'wed', slot: 't7', subject: 'Pr(Computer A/B-6)', span: 1, color: 'bg-slate-300 text-slate-900 border-slate-400' },
  { day: 'wed', slot: 't8', subject: 'Pr(COA-11)', span: 1, color: 'bg-slate-300 text-slate-900 border-slate-400' },
  { day: 'wed', slot: 't9', subject: 'Pr(Computer A/B-8)', span: 2, color: 'bg-slate-300 text-slate-900 border-slate-400' },

  { day: 'thu', slot: 't1', subject: 'Pr(WPD-9)', span: 1, color: 'bg-blue-300 text-blue-900 border-blue-400' },
  { day: 'thu', slot: 't2', subject: 'Pr(FCA-9)\nPr(Chemistry-11)', span: 1, color: 'bg-blue-300 text-blue-900 border-blue-400' },
  { day: 'thu', slot: 't3', subject: 'Pr(Chemistry-11)', span: 2, color: 'bg-blue-300 text-blue-900 border-blue-400' },
  { day: 'thu', slot: 't5', subject: 'Pr(FES-9)', span: 3, color: 'bg-blue-300 text-blue-900 border-blue-400' },
  { day: 'thu', slot: 't8', subject: 'Pr(SEP-12)', span: 1, color: 'bg-blue-300 text-blue-900 border-blue-400' },
  { day: 'thu', slot: 't9', subject: 'Pr(CRM-10)', span: 1, color: 'bg-blue-300 text-blue-900 border-blue-400' },
  { day: 'thu', slot: 't10', subject: 'Pr(OOP-10)', span: 1, color: 'bg-blue-300 text-blue-900 border-blue-400' },

  { day: 'fri', slot: 't1', subject: 'Pr(WPD-9)', span: 1, color: 'bg-green-300 text-green-900 border-green-400' },
  { day: 'fri', slot: 't2', subject: 'Pr(FCA-9)', span: 1, color: 'bg-green-300 text-green-900 border-green-400' },
  { day: 'fri', slot: 't3', subject: 'Pr(CN-12)', span: 2, color: 'bg-green-300 text-green-900 border-green-400' },
  { day: 'fri', slot: 't5', subject: 'Pr(Physics-11)\nPr(CT-12)', span: 1, color: 'bg-green-300 text-green-900 border-green-400' },
  { day: 'fri', slot: 't6', subject: 'Pr(Physics-11)', span: 3, color: 'bg-green-300 text-green-900 border-green-400' },
  { day: 'fri', slot: 't9', subject: 'Pr(CRM-10)', span: 1, color: 'bg-green-300 text-green-900 border-green-400' },
  { day: 'fri', slot: 't10', subject: 'Pr(OOP-10)', span: 1, color: 'bg-green-300 text-green-900 border-green-400' },
]

export default function RoutineMatrix() {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-300 print:border-2 print:border-black print:rounded-none">
      <table className="w-full border-collapse min-w-[1000px] text-sm print:text-[10px]">
        <thead>
          <tr>
            <th className="border border-gray-300 print:border-black p-2 bg-yellow-100 text-yellow-900 font-bold w-16 text-center">
              Day / Time
            </th>
            {TIME_SLOTS.map((slot) => (
              <th key={slot.id} className="border border-gray-300 print:border-black p-2 bg-yellow-100 text-yellow-900 font-bold text-center">
                <div className="text-xs">{slot.label}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((day) => {
            const daySchedules = MOCK_SCHEDULES.filter((s) => s.day === day.id)
            
            // Build the row, respecting colSpans
            const cells = []
            let skipSlots = 0

            for (let i = 0; i < TIME_SLOTS.length; i++) {
              if (skipSlots > 0) {
                skipSlots--
                continue
              }

              const slotId = TIME_SLOTS[i].id
              const schedule = daySchedules.find((s) => s.slot === slotId)

              if (schedule) {
                cells.push(
                  <td 
                    key={slotId} 
                    colSpan={schedule.span} 
                    className={`border border-gray-300 print:border-black p-2 font-semibold text-center whitespace-pre-wrap ${schedule.color}`}
                  >
                    {schedule.subject}
                  </td>
                )
                skipSlots = schedule.span - 1
              } else {
                // Empty cell (usually rendered with the row's background color in the original image, we'll use a light color)
                cells.push(
                  <td key={slotId} className={`border border-gray-300 print:border-black p-2 ${day.id === 'mon' ? 'bg-blue-100/50' : day.id === 'tue' ? 'bg-orange-100/50' : day.id === 'wed' ? 'bg-slate-100' : day.id === 'thu' ? 'bg-blue-100' : 'bg-green-100'}`}>
                  </td>
                )
              }
            }

            return (
              <tr key={day.id}>
                <td className="border border-gray-300 print:border-black p-2 font-bold text-center bg-gray-100">
                  {day.label}
                </td>
                {cells}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
