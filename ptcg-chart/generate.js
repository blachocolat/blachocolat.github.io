javascript: (async () => {
  class ImagePieChart {
    constructor(chartData) {
      this.chartData = chartData || []
      this.title = LocalStorage.getString('title', '')
      this.otherRatio = LocalStorage.getFloat('otherRatio', 0.15)
      this.hideLabel = LocalStorage.getBoolean('hideLabel', false)
      this.transparentBackground = LocalStorage.getBoolean('transparentBackground', false)
      this.scale = 1.25
      this.offsetX = 0
      this.offsetY = -20
      this.holeRadius = 60

      this.canvasEl = ImagePieChart._injectChart()
      this.chart = new Chartist.Pie(
        '#ct-chart',
        this.chartistData,
        this.chartistOptions
      )

      this.renderedSlicesCount = 0
      this.renderedLabelsCount = this.hideLabel ? this.chartistData.labels.length : 0
      this.onDraw = null
  
      const baseWidth = 360   // 63 x 5.714
      const baseHeight = 503  // 88 x 5.714
  
      this.chart.on(
        'draw',
        async (context) => {
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
                180 +
                this.offsetX
              const offsetY =
                context.radius * ((minY + maxY) / 2 - ((maxY - minY) / 2 - 1)) +
                18 +
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
              console.log(`[${context.index}] = (${image.width.baseVal.value},${image.height.baseVal.value})`)
              image.setAttribute('width', `${width}`)
              image.setAttribute('height', `${height}`)
              image.setAttribute('href', await createDataURL(imageSrc))
  
              pattern.appendChild(image)
              defs.appendChild(pattern)
              this.chart.svg._node.appendChild(defs)
  
              context.element._node.setAttribute(
                'style',
                `fill: url(#${imageId})`
              )

              await new Promise((resolve, reject) => {
                const interval = setInterval(() => {
                  if (image.width.baseVal.value == 0 || image.height.baseVal.value == 0) {
                    return
                  }
                  console.log(`[${context.index}] = (${image.width.baseVal.value},${image.height.baseVal.value})`)
                  clearInterval(interval)
                  resolve()
                }, 1000 / 60)
              })
            } else {
              context.element._node.setAttribute('style', 'fill: #9e9e9e')
            }

            this.renderedSlicesCount += 1
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
                ImagePieChart._drawText(context.element._node, matches[1], {
                  x: `${context.x}`,
                  dy: '1.1em',
                  className: 'ct-label--border ct-label--strong',
                })
                ImagePieChart._drawText(context.element._node, matches[2], {
                  className: 'ct-label--border',
                })
                ImagePieChart._drawText(context.element._node, matches[1], {
                  x: `${context.x}`,
                  className: 'ct-label--strong',
                })
                ImagePieChart._drawText(context.element._node, matches[2])
              } else {
                ImagePieChart._drawText(context.element._node, line, {
                  x: `${context.x}`,
                  dy: '1.1em',
                  className: 'ct-label--border',
                })
                ImagePieChart._drawText(context.element._node, line, {
                  x: `${context.x}`,
                })
              }
            })
  
            const firstChild = context.element._node.firstChild
            if (firstChild instanceof SVGElement) {
              firstChild.removeAttribute('x')
              firstChild.removeAttribute('dy')
            }

            this.renderedLabelsCount += 1
          }

          // fire the callback when all images have been loaded
          console.log(context)
          if (
            this.onDraw &&
            this.renderedSlicesCount == this.chartistData.imageSrcs.length &&
            this.renderedLabelsCount == this.chartistData.labels.length
          ) {
            await this.onDraw()
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
        donutWidth: 175 - this.holeRadius,
        chartPadding: 20,
        labelOffset: 40,
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

    static _injectChart() {
      // do nothing if elements have been already injected
      let el = document.querySelector('#ct-canvas')
      if (el) {
        return el
      }

      el = document.createElement('div')
      el.id = 'ct-canvas'
      el.style['width'] = '720px'
      el.style['position'] = 'absolute'
      el.style['top'] = 0
      el.style['opacity'] = 0.0
      
      const containerEl = document.createElement('div')
      containerEl.className = 'ct-container'
      
      const chartEl = document.createElement('div')
      chartEl.id = 'ct-chart'
      chartEl.className = 'ct-chart'

      containerEl.append(chartEl)
      el.append(containerEl)
      document.body.append(el)

      return el
    }

    static _drawText(parentEl, text, attributes) {
      const svgNS = 'http://www.w3.org/2000/svg'
      const tspan = document.createElementNS(svgNS, 'tspan')
  
      if (attributes) {
        Object.entries(attributes).forEach(([name, value]) => {
          tspan.setAttribute(name == 'className' ? 'class' : name, value)
        })
      }
  
      tspan.textContent = text
      parentEl.append(tspan)
    }

    static _createTitleElement(title) {
      const titleEl = document.createElement('span')
      titleEl.style['font-weight'] = 700
      titleEl.style['font-size'] = '1.2rem'
      titleEl.style['display'] = 'block'
      titleEl.className = 'Title'
      titleEl.textContent = title
      return titleEl
    }

    static _createTextInputElement(title, placeholder, defaultValue, onChange) {
      const el = document.createElement('div')
      el.style['width'] = 'calc(100% - 120px)'

      const titleEl = ImagePieChart._createTitleElement(title)

      const labelEl = document.createElement('label')
      labelEl.className = 'KSTextInput'

      const inputEl = document.createElement('textarea')
      inputEl.rows = 1
      inputEl.value = defaultValue
      inputEl.placeholder = placeholder
      inputEl.className = 'KSTextInput_text'
      inputEl.style['height'] = '44px'
      inputEl.style['padding'] = '10px 6px'
      inputEl.style['margin-top'] = '8px'
      inputEl.style['margin-bottom'] = '8px'
      inputEl.oninput = () => {
        if (onChange) { onChange(inputEl) }
      }
      labelEl.append(inputEl)

      el.append(titleEl, labelEl)
      return el
    }

    static _createSelectElement(title, options, defaultValue, onChange) {
      const el = document.createElement('div')
      el.style['width'] = '120px'

      const titleEl = ImagePieChart._createTitleElement(title)

      const labelEl = document.createElement('label')
      labelEl.className = 'KSSelect'
      labelEl.style['width'] = 'calc(100% - 2px)'
      labelEl.style['margin-top'] = '8px'
      labelEl.style['margin-bottom'] = '8px'

      const labelInnerEl = document.createElement('div')
      labelInnerEl.className = 'KSSelect_inner'

      const selectEl = document.createElement('select')
      selectEl.title = 'その他の割合'
      selectEl.className = 'KSSelect_text'
      selectEl.style['border-radius'] = '7px'
      selectEl.onchange = () => {
        if (onChange) { onChange(selectEl) }
      }

      options.forEach((option) => {
        const optionEl = document.createElement('option')
        optionEl.value = option.value
        optionEl.textContent = option.label
        if (optionEl.value == defaultValue) {
          optionEl.selected = 'selected'
        }
        selectEl.append(optionEl)
      })

      labelInnerEl.append(selectEl)
      labelEl.append(labelInnerEl)

      el.append(titleEl, labelEl)
      return el
    }

    static _createCheckBoxElement(label, defaultValue, onChange) {
      const el = document.createElement('label')
      el.className = 'KSCheckBox'
      el.style['margin-right'] = '0.5em'
  
      const inputEl = document.createElement('input')
      inputEl.type = 'checkbox'
      inputEl.className = 'KSCheckBoxInput'
      inputEl.checked = defaultValue
      inputEl.onchange = () => {
        if (onChange) { onChange(inputEl) }
      }
  
      const spanEl = document.createElement('span')
      spanEl.className = 'KSCheck'
  
      const labelEl = document.createElement('span')
      labelEl.className = 'KSFormText'
      labelEl.textContent = label
  
      el.append(inputEl, spanEl, labelEl)
      return el
    }
  
    static _createButtonElement(label, onPress) {
      const el = document.createElement('div')
      el.className = 'Layout Layout-center'

      const buttonEl = document.createElement('a')
      buttonEl.className = KS.UA.Tablet || KS.UA.Mobile
        ? 'Button Button-texture Button-responsive Button-large noLinkBtn'
        : 'Button Button-texture noLinkBtn'
      buttonEl.onclick = async () => {
        if (onPress) { await onPress(buttonEl) }
      }
      const spanEl = document.createElement('span')
      spanEl.className = 'bebel'
      spanEl.textContent = label

      buttonEl.append(spanEl)
      el.append(buttonEl)
      return el
    }

    injectControlElements() {
      // do nothing if elements have been already injected
      const parentEl = document.querySelector('div.MainArea > div.ContentsArea > section')
      let layoutEl = parentEl.querySelector('#ct-layout')
      if (layoutEl) {
        return layoutEl
      }
  
      layoutEl = document.createElement('div')
      layoutEl.id = 'ct-layout'
      layoutEl.className = 'Layout'

      const headEl = document.createElement('h2')
      headEl.className = 'Heading2'
      headEl.textContent = 'デッキ分布図つくるマシーン'

      const containerEl = document.createElement('div')
      containerEl.style['display'] = 'flex'

      const inputEl = ImagePieChart._createTextInputElement(
        'タイトル',
        '大会名など',
        this.title,
        (el) => {
          this.title = el.value
        })
      inputEl.style['margin-bottom'] = '4px'
      inputEl.style['margin-right'] = '0.7em'
      const selectEl = ImagePieChart._createSelectElement(
        'その他の割合',
        [
          { label: '0%', value: 0.00 },
          { label: '5%', value: 0.05 },
          { label: '10%', value: 0.10 },
          { label: '15%', value: 0.15 },
          { label: '20%', value: 0.20 },
          { label: '25%', value: 0.25 },
          { label: '30%', value: 0.30 },
          { label: '35%', value: 0.35 },
          { label: '40%', value: 0.40 },
        ],
        this.otherRatio,
        (el) => {
          this.otherRatio = el.value
        })
      selectEl.style['margin-bottom'] = '4px'
      containerEl.append(inputEl, selectEl)

      const checkLabelEl = ImagePieChart._createCheckBoxElement(
        'ラベルを隠す',
        this.hideLabel,
        (el) => {
          this.hideLabel = el.checked
        })
      const checkBackgroundEl = ImagePieChart._createCheckBoxElement(
        '背景を透過する',
        this.transparentBackground,
        (el) => {
          this.transparentBackground = el.checked
        })
      const buttonEl = ImagePieChart._createButtonElement(
        'デッキ分布図をつくる',
        (el) => {
          this.onPress(el)
        })
  
      layoutEl.append(headEl, containerEl, checkLabelEl, checkBackgroundEl, buttonEl)
      parentEl.append(layoutEl)
      return layoutEl
    }
  
    static _injectInputElements() {
      // inject custom input elements
      const cardNames = LocalStorage.getObject('cardNames', {})
  
      Array.from(document.querySelectorAll('#cardImagesView > div > div > table > tbody'))
        .forEach((el) => {
          // do nothing if elements have been already injected
          if (el.querySelector('tr:last-child > td > input[type="text"]')) {
            return
          }
          const imageEl = el.querySelector('tr.imgBlockArea > td > a > img')
          const cardId = parseInt(imageEl.id.replace(/^img_([0-9]+)$/, '$1'), 10)
          const originCardName = imageEl.alt.replace(/&amp;/g, '&')
          imageEl.alt = cardNames.hasOwnProperty(cardId)
            ? cardNames[cardId]
            : originCardName
          {
            const countEl = el.querySelector('tr > td.cPos.nowrap > *')
            countEl.style['marginTop'] = 0
            countEl.style['marginBottom'] = 0
  
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
          inputEl.value = cardNames.hasOwnProperty(cardId)
            ? cardNames[cardId]
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
  
      // update global variable
      const scriptEl = document.createElement('script')
      scriptEl.append(`
        PCGDECK.cardCntChange=function(f,e,k){var l=$("#"+f).val();if(l!=""){var h=l.split("-");var i=h.length;var g=[];for(ii=0;ii<i;ii++){var j=h[ii].split("_");if(j[0]==e){j[1]=parseInt(j[1],10)+k;if(j[1]<=0){j[1]=0}g.push(j.join("_"));PCGDECK.errorItemClear(j[0])}else{g.push(h[ii])}}$("#"+f).val(g.join("-"));PCGDECK.cardTableViewCall(1)}return false};
        PCGDECK.cardCntSet=function(f,e,k){var l=$("#"+f).val();if(l!=""){var h=l.split("-");var i=h.length;var g=[];for(ii=0;ii<i;ii++){var j=h[ii].split("_");if(j[0]==e){m=parseInt(j[1],10);j[1]=k;if(j[1]<=0){j[1]=0}PCGDECK.cardViewCnt+=j[1]-m;g.push(j.join("_"));PCGDECK.errorItemClear(j[0])}else{g.push(h[ii])}}$("#"+f).val(g.join("-"));PCGDECK.setCookieCall(f)}return false};
      `)
      document.body.append(scriptEl)
      scriptEl.remove()
    }
  
    injectInputElements() {
      ImagePieChart._injectInputElements()

      // reinject elements when the observed elements are updated
      injectGlobalObserver('#cardImagesView', () => {
        ImagePieChart._injectInputElements()
      })
    }

    draw(chartData, onDraw) {
      this.chartData = chartData
      this.renderedSlicesCount = 0
      this.renderedLabelsCount = this.hideLabel ? this.chartistData.labels.length : 0

      // draw the title
      const titleBorderEl = document.createElement('div')
      titleBorderEl.className = 'ct-title ct-title--border'
      titleBorderEl.textContent = this.title
      const titleEl = document.createElement('div')
      titleEl.className = 'ct-title'
      titleEl.textContent = this.title

      // draw the signature
      const twitterEl = document.createElement('span')
      twitterEl.className = 'ct-twitter'
      const signatureEl = document.createElement('div')
      signatureEl.className = 'ct-signature'
      signatureEl.append('powered by', twitterEl, '@tilanosaur')

      this.canvasEl.querySelector('.ct-container').append(titleBorderEl, titleEl, signatureEl)

      this.onDraw = async () => {
        if (onDraw) { await onDraw() }
        titleBorderEl.remove()
        titleEl.remove()
        twitterEl.remove()
        signatureEl.remove()
      }
      this.chart.update(this.chartistData, this.chartistOptions)
    }

    async onPress(el) {
      el.classList.add('disabled')
      el.classList.add('loading')

      // save current settings
      LocalStorage.setItem('title', this.title)
      LocalStorage.setItem('otherRatio', this.otherRatio)
      LocalStorage.setItem('hideLabel', this.hideLabel)
      LocalStorage.setItem('transparentBackground', this.transparentBackground)
  
      const cards = fetchCards()
  
      // save card names into the storage
      const cardNames = LocalStorage.getObject('cardNames', {})
      cards.forEach((card) => {
        cardNames[card.id] = card.name
      })
      LocalStorage.setItem('cardNames', JSON.stringify(cardNames))
  
      // draw with dataURL images
      // const promises = cards.map(async (card) => {
      //   return {
      //     label: card.name,
      //     value: card.count,
      //     imageSrc: card.imageSrc ? await createDataURL(card.imageSrc) : new Promise(),
      //   }
      // })
      // const chartData = await Promise.all(promises)
      const chartData = cards.map((card) => {
        return {
          label: card.name,
          value: card.count,
          imageSrc: card.imageSrc,
        }
      })
      this.draw(chartData, async () => {
        await this.openAsPNG()
        el.classList.remove('disabled')
        el.classList.remove('loading')
      })
    }

    async openAsPNG() {
      // open image in a new tab
      const canvas = await html2canvas(this.canvasEl, {
        scale: 16 / 9,
        backgroundColor: !this.transparentBackground ? '#ffffff' : null,
        onclone: (d) => {
          const el = d.getElementById(this.canvasEl.id)
          el.style['opacity'] = 1.0
        },
      })
      const dataURL = canvas.toDataURL('image/png')
      const w = window.open()

      if (w) {
        w.document.write(`<img src="${dataURL}" />`)
      } else {
        window.alert('ポップアップウインドウが許可されていないため、デッキ分布図を作成できませんでした。')
      }
    }
  }

  class LocalStorage {
    static getItem(key) {
      return window.localStorage.getItem(`PTCGChart::${key}`)
    }

    static getBoolean(key, defaultValue) {
      const value = LocalStorage.getItem(key)
      return value != null ? value === 'true' : (defaultValue || false)
    }

    static getInt(key, defaultValue) {
      const value = LocalStorage.getItem(key)
      return value != null ? parseInt(value) : (defaultValue || 0)
    }

    static getFloat(key, defaultValue) {
      const value = LocalStorage.getItem(key)
      return value != null ? parseFloat(value) : (defaultValue || 0.0)
    }

    static getString(key, defaultValue) {
      const value = LocalStorage.getItem(key)
      return value != null ? value : (defaultValue || '')
    }

    static getObject(key, defaultValue) {
      const value = LocalStorage.getItem(key)
      return value != null ? JSON.parse(value) : (defaultValue || {})
    }

    static setItem(key, value) {
      if (value != null) {
        window.localStorage.setItem(`PTCGChart::${key}`, value)
      }
    }
  }

  const injectGlobalObserver = (selector, onUpdate) => {
    if (typeof globalObserver === 'undefined') {
      // global define
      globalObserver = new MutationObserver(async (_) => {
        if (onUpdate) { onUpdate() }
      })
      globalObserver.observe(
        document.querySelector(selector),
        { childList: true }
      )
    }
  }

  const createDataURL = (url) => {
    return new Promise((resolve, reject) => {
      const image = new Image()
      image.crossOrigin = 'Anonymous'
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
      el.onload = () => { resolve() }
      el.href = href
      document.head.append(el)
    })
  }

  const injectScript = (src) => {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.onload = () => { resolve() }
      el.src = src
      document.head.append(el)
    })
  }

  // inject stylesheets and scripts
  await injectStyleSheet('https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.css')
  await injectStyleSheet('https://blachocolat.github.io/ptcg-chart/style.css')
  await injectScript('https://cdn.jsdelivr.net/chartist.js/latest/chartist.min.js')
  await injectScript('https://cdn.jsdelivr.net/npm/html2canvas/dist/html2canvas.min.js')

  const ipc = new ImagePieChart()
  ipc.injectControlElements()
  ipc.injectInputElements()
})()