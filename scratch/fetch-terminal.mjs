const res = await fetch('http://localhost:3000/terminal/PC-01')
const text = await res.text()
console.log('STATUS:', res.status)
const routineIdx = text.indexOf('Active Practical Routine')
if (routineIdx !== -1) {
  console.log('SNIPPET:', text.slice(routineIdx - 50, routineIdx + 400))
} else {
  console.log('Active Practical Routine NOT FOUND')
}
