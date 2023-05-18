javascript: (async () => {
  class ImagePieChart {
    constructor(parentEl, chartData) {
      this.chartData = chartData
      this.title = ''
      this.otherRatio = 0.15
      this.hideLabel = false
      this.transparentBackground = false
      this.scale = 1.25
      this.offsetX = 0
      this.offsetY = -20
      this.holeRadius = 60

      this.el = ImagePieChart.injectChart(parentEl)
      this.chart = new Chartist.Pie(
        `#${this.el.id}`,
        this.chartistData,
        this.chartistOptions
      )
  
      const baseWidth = 320
      const baseHeight = 447
  
      this.chart.on(
        'draw',
        (context) => {
          if (context.type == 'slice') {
            const imageSrc = this.chartistData.imageSrcs[context.index]
  
            if (imageSrc) {
              const imageId = `img-${Math.random().toString(36).substr(2, 8)}`
  
              const angleList = [
                context.startAngle,
                context.endAngle,
                0,
                90,
                180,
                270,
              ]
              let minX = Number.MAX_VALUE
              let minY = Number.MAX_VALUE
              let maxX = -Number.MAX_VALUE
              let maxY = -Number.MAX_VALUE
  
              for (const angle of angleList) {
                if (angle < context.startAngle) {
                  continue
                }
                if (context.endAngle < angle) {
                  break
                }
  
                const outerX = Math.sin(angle * (Math.PI / 180))
                const outerY = -Math.cos(angle * (Math.PI / 180))
                const innerX = outerX * (this.holeRadius / context.radius)
                const innerY = outerY * (this.holeRadius / context.radius)
                minX = Math.min(minX, innerX, outerX)
                minY = Math.min(minY, innerY, outerY)
                maxX = Math.max(maxX, innerX, outerX)
                maxY = Math.max(maxY, innerY, outerY)
              }
  
              const scale = (Math.max(maxX - minX, maxY - minY) / 2) * this.scale
              const width = baseWidth * scale
              const height = baseHeight * scale
              const offsetX =
                context.radius * ((minX + maxX) / 2 - (scale - 1)) +
                200 +
                this.offsetX
              const offsetY =
                context.radius * ((minY + maxY) / 2 - ((maxY - minY) / 2 - 1)) +
                20 +
                this.offsetY
  
              const svgNS = 'http://www.w3.org/2000/svg'
              const defs = document.createElementNS(svgNS, 'defs')
  
              const pattern = document.createElementNS(svgNS, 'pattern')
              pattern.setAttribute('id', imageId)
              pattern.setAttribute('patternUnits', 'userSpaceOnUse')
              pattern.setAttribute('x', `${offsetX}`)
              pattern.setAttribute('y', `${offsetY}`)
              pattern.setAttribute('width', `${width}`)
              pattern.setAttribute('height', `${height}`)
  
              const image = document.createElementNS(svgNS, 'image')
              image.setAttribute('href', imageSrc)
              image.setAttribute('width', `${width}`)
              image.setAttribute('height', `${height}`)
  
              pattern.appendChild(image)
              defs.appendChild(pattern)
              this.chart.svg._node.appendChild(defs)
  
              context.element._node.setAttribute(
                'style',
                `fill: url(#${imageId})`
              )
            } else {
              context.element._node.setAttribute('style', 'fill: #9E9E9E')
            }
          } else if (context.type == 'label') {
            const lines = context.text.split('\n')
  
            context.element._node.textContent = ''
            context.element._node.setAttribute('x', `${context.x}`)
            context.element._node.setAttribute('y', `${context.y}`)
            context.element._node.setAttribute('dy', `${1.5 - lines.length}em`)
            context.element._node.removeAttribute('dx')
  
            lines.forEach((line) => {
              // emphasize the percentage
              const matches = line.match(/^([0-9]{1,3})((?:\.[0-9]+)?%)$/)
  
              if (matches?.length == 3) {
                ImagePieChart.drawText(context.element._node, matches[1], {
                  x: `${context.x}`,
                  dy: '1.1em',
                  className: 'ct-label--border ct-label--strong',
                })
                ImagePieChart.drawText(context.element._node, matches[2], {
                  className: 'ct-label--border',
                })
                ImagePieChart.drawText(context.element._node, matches[1], {
                  x: `${context.x}`,
                  className: 'ct-label--strong',
                })
                ImagePieChart.drawText(context.element._node, matches[2])
              } else {
                ImagePieChart.drawText(context.element._node, line, {
                  x: `${context.x}`,
                  dy: '1.1em',
                  className: 'ct-label--border',
                })
                ImagePieChart.drawText(context.element._node, line, {
                  x: `${context.x}`,
                })
              }
            })
  
            const firstChild = context.element._node.firstChild
            if (firstChild instanceof SVGElement) {
              firstChild.removeAttribute('x')
              firstChild.removeAttribute('dy')
            }
          }
        }
      )
    }

    get chartistData() {
      this.chartData.sort((a, b) => {
        return b.value - a.value // order by value desc
      })
      const total = this.chartData
        .map((data) => data.value)
        .reduce((a, b) => a + b, 0)
      let subTotal = 0
      let minValue = 0
  
      for (const data of this.chartData) {
        if (1 - this.otherRatio <= subTotal / total) {
          minValue = data.value
          break
        }
        subTotal += data.value
      }
  
      const filteredData = this.chartData.filter((data) => data.value > minValue)
      if (filteredData.length < this.chartData.length) {
        const filteredTotal = filteredData
          .map((data) => data.value)
          .reduce((a, b) => a + b, 0)
        filteredData.push({
          label: 'その他',
          value: total - filteredTotal,
        })
      }
  
      return {
        labels: filteredData.map((data) => data.label),
        series: filteredData.map((data) => data.value),
        imageSrcs: filteredData.map((data) => data.imageSrc),
      }
    }

    get chartistOptions() {
      return {
        donut: true,
        donutSolid: true,
        donutWidth: 160 - this.holeRadius,
        chartPadding: 20,
        labelOffset: 30,
        labelDirection: 'explode',
        showLabel: !this.hideLabel,
        labelInterpolationFnc: (label, index) => {
          const total = this.chartistData.series.reduce((a, b) => a + b, 0)
          const ratio = (this.chartistData.series[index] / total) * 100
          return typeof label == 'string'
            ? `${label}\n${ratio.toFixed(1)}%`
            : `${ratio.toFixed(1)}%`
        },
      }
    }

    async captureAsPNG() {
      // redraw with dataURL images
      const promises = this.chartistData.imageSrcs.map((url) => {
        return url ? ImagePieChart.createDataURL(url) : url
      })
      const dataURLs = await Promise.all(promises)
      const chartistData = Object.assign(this.chartistData, {
        imageSrcs: dataURLs,
      })
      this.chart.update(chartistData, this.chartistOptions)

      // save as PNG
      const canvas = await html2canvas(this.el, {
        scale: 16 / 9,
        backgroundColor: !this.transparentBackground ? '#ffffff' : null
      })

      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `デッキ分布図.png`
      a.click()
      a.remove()
    }

    static injectChart(parentEl) {
      // do nothing if elements have been already injected
      let chartEl = document.querySelector('#ct-chart')
      if (chartEl) {
        return chartEl
      }

      const el = document.createElement('div')
      el.style['max-width'] = '720px'

      const containerEl = document.createElement('div')
      containerEl.className = 'ct-container'
  
      chartEl = document.createElement('div')
      chartEl.id = 'ct-chart'
      chartEl.className = 'ct-chart'

      containerEl.appendChild(chartEl)
      el.appendChild(containerEl)
      parentEl.appendChild(el)

      return chartEl
    }

    static drawText(parentEl, text, attributes) {
      const svgNS = 'http://www.w3.org/2000/svg'
      const tspan = document.createElementNS(svgNS, 'tspan')
  
      if (attributes) {
        Object.entries(attributes).forEach(([name, value]) => {
          tspan.setAttribute(name == 'className' ? 'class' : name, value)
        })
      }
  
      tspan.textContent = text
      parentEl.appendChild(tspan)
    }

    static createDataURL(url) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = image.width
          canvas.height = image.height
          const context = canvas.getContext('2d')
          context?.drawImage(image, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        }
        image.onerror = reject
        image.src = url
      })
    }
  }

  const injectElement = () => {
    globalCardNames = {}//JSON.parse('${JSON.stringify(options.cardNames)}')
    Array.from(document.querySelectorAll('#cardImagesView > div > div > table > tbody'))
      .forEach((el) => {
        // do nothing if elements have been already injected
        if (el.querySelector('tr:last-child > td > input[type=text]')) {
          return
        }
        const imageEl = el.querySelector('tr.imgBlockArea > td > a > img')
        const cardId = parseInt(imageEl.id.replace(/^img_([0-9]+)$/, '$1'), 10)
        const originCardName = imageEl.alt.replace(/&amp;/g, '&')
        imageEl.alt = globalCardNames.hasOwnProperty(cardId)
          ? globalCardNames[cardId]
          : originCardName
        {
          const countEl = el.querySelector('tr > td.cPos.nowrap > *')
          if (countEl?.querySelector('span')) {
            const inputEl = document.createElement('input')
            inputEl.type = 'text'
            inputEl.pattern = '^[0-9]+$'
            inputEl.value = parseInt(countEl.innerText, 10)
            inputEl.style['width'] = 'calc(100% - 56px)'
            inputEl.style['margin-right'] = '4px'
            inputEl.style['padding'] = '3px 6px'
            inputEl.style['box-sizing'] = 'border-box'
            inputEl.style['border'] = 'solid 2px #ddd'
            inputEl.style['background-color'] = '#fff'
            inputEl.style['border-radius'] = '4px'
            inputEl.oninput = () => {
              // allow only half-width numbers
              inputEl.value = inputEl.value
                .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 65248))
                .replace(/[^0-9]/g, '')

              // update global variable
              const deckType =
                countEl.querySelector('a').getAttribute('onclick').replace(/^javascript:PCGDECK.cardCntChange\('(deck_[^']+)', '[0-9]+', -1\); return false;$/, '$1')
              const scriptEl = document.createElement('script')
              scriptEl.append(`
                PCGDECK.cardCntSet("${deckType}", ${cardId}, ${parseInt(inputEl.value, 10) || 0})
                $("#cardCntImagesArea").text("現在のデッキ内には "+PCGDECK.cardViewCnt+" 枚のカードが選択されています")
                $("#cardCntImagesArea").append($("<div />").text("削除したカードは「調整用カード」枠に入ります ").addClass("Text-annotation"));
              `)
              document.body.append(scriptEl)
              scriptEl.remove()
            }
            countEl.prepend(inputEl)
            countEl.querySelector('span').remove()
            countEl.querySelector('br').remove()
          }
        }
        const trEl = document.createElement('tr')
        const tdEl = document.createElement('td')
        tdEl.setAttribute('colspan', 2)
        const inputEl = document.createElement('input')
        inputEl.type = 'text'
        inputEl.value = globalCardNames.hasOwnProperty(cardId)
          ? globalCardNames[cardId]
          : originCardName
        inputEl.placeholder = originCardName
        inputEl.style['width'] = '100%'
        inputEl.style['padding'] = '3px 6px'
        inputEl.style['box-sizing'] = 'border-box'
        inputEl.style['border'] = 'solid 2px #ddd'
        inputEl.style['background-color'] = '#fff'
        inputEl.style['border-radius'] = '4px'
        inputEl.oninput = () => {
          // update global variable
          const scriptEl = document.createElement('script')
          scriptEl.append(`
            PCGDECK.searchItemNameAlt[${cardId}] = "${inputEl.value}"
          `)
          document.body.append(scriptEl)
          scriptEl.remove()
          // update alt in editing
          imageEl.alt = inputEl.value
        }
        tdEl.append(inputEl)
        trEl.append(tdEl)
        el.append(trEl)
      })

      if (typeof globalScriptEl === 'undefined') {
        // update global variable
        globalScriptEl = document.createElement('script')
        globalScriptEl.append(`
          PCGDECK.cardCntChange=function(f,e,k){var l=$("#"+f).val();if(l!=""){var h=l.split("-");var i=h.length;var g=[];for(ii=0;ii<i;ii++){var j=h[ii].split("_");if(j[0]==e){j[1]=parseInt(j[1],10)+k;if(j[1]<=0){j[1]=0}g.push(j.join("_"));PCGDECK.errorItemClear(j[0])}else{g.push(h[ii])}}$("#"+f).val(g.join("-"));PCGDECK.cardTableViewCall(1)}return false};
          PCGDECK.cardCntSet=function(f,e,k){var l=$("#"+f).val();if(l!=""){var h=l.split("-");var i=h.length;var g=[];for(ii=0;ii<i;ii++){var j=h[ii].split("_");if(j[0]==e){m=parseInt(j[1],10);j[1]=k;if(j[1]<=0){j[1]=0}PCGDECK.cardViewCnt+=j[1]-m;g.push(j.join("_"));PCGDECK.errorItemClear(j[0])}else{g.push(h[ii])}}$("#"+f).val(g.join("-"));PCGDECK.setCookieCall(f)}return false};
        `)
        document.body.append(globalScriptEl)
        globalScriptEl.remove()
      }
  }

  const fetchCards = () => {
    return Array.from(document.querySelectorAll('#cardImagesView > div > div > table > tbody'))
      .map((el) => {
        const imageEl = el.querySelector('tr.imgBlockArea > td > a > img')
        const cardId = parseInt(imageEl.id.replace(/^img_([0-9]+)$/, '$1'), 10)
        const countEl = el.querySelector('tr > td.cPos.nowrap > *')
        const inputEl = countEl?.querySelector('input[type="text"]')
        return {
          id: cardId,
          name: imageEl.alt,
          imageSrc: imageEl.src,
          count: parseInt(inputEl?.value || countEl?.innerText, 10) || 0,
        }
      })
      .filter((data) => data.count > 0)
  }

  const injectStyleSheet = (href) => {
    return new Promise((resolve, reject) => {
      const el = document.createElement('link')
      el.rel = 'stylesheet'
      el.onload = () => {
        resolve()
      }
      el.href = href
      document.head.appendChild(el)
    })
  }

  const injectScript = (src) => {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.onload = () => {
        resolve()
      }
      el.src = src
      document.head.appendChild(el)
    })
  }

  await injectStyleSheet('https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css')
  await injectStyleSheet('http://127.0.0.1:8080/ptcg-chart/style.css')
  await injectScript('https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js')
  await injectScript('https://cdn.jsdelivr.net/npm/html2canvas/dist/html2canvas.min.js')

  const parentEl = document.querySelector('#inputArea')
  const chartData = fetchCards().map((data) => {
    return {
      label: data.name,
      value: data.count,
      imageSrc: data.imageSrc,
    }
  })
  const ipc = new ImagePieChart(parentEl, chartData)
  await ipc.captureAsPNG()
})()