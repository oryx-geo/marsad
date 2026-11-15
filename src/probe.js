// MARSAD · written with the help of an SI (Super Intelligence) coding assistant; reviewed and tested by team ORYX GEO.
// Read the radar brightness of one point from the pictures already on the site.
// Each picture stores decibels as grey levels 1..255 (0 = no data), see processing/build.py.

const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

function load(url) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = url
  })
}

export async function probe({ urls, bbox, size, stretch, lon, lat }) {
  const [w, s, e, n] = bbox
  const [W, H] = size
  const px = Math.floor(((lon - w) / (e - w)) * W)
  const py = Math.floor(((mercY(n) - mercY(lat)) / (mercY(n) - mercY(s))) * H)
  if (px < 2 || py < 2 || px > W - 3 || py > H - 3) return null
  const K = 5 // average 5 x 5 cells to calm the radar speckle
  const canvas = document.createElement('canvas')
  canvas.width = K
  canvas.height = K
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const out = []
  for (const { date, url } of urls) {
    const im = await load(url)
    const fx = im.naturalWidth / W, fy = im.naturalHeight / H
    ctx.clearRect(0, 0, K, K)
    ctx.drawImage(im, Math.round((px - 2) * fx), Math.round((py - 2) * fy), K, K, 0, 0, K, K)
    const d = ctx.getImageData(0, 0, K, K).data
    let sum = 0, cnt = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 0) {
        const dB = stretch[0] + ((d[i] - 1) / 254) * (stretch[1] - stretch[0])
        sum += Math.pow(10, dB / 10) // average in power, not in decibels
        cnt += 1
      }
    }
    out.push({ date, db: cnt ? +(10 * Math.log10(sum / cnt)).toFixed(1) : null })
  }
  return out
}
