import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { acompanharFormularios, temDadosNaoSalvos } from './formularios'

let parar: () => void

beforeEach(() => {
  parar = acompanharFormularios()
})

afterEach(() => {
  parar()
  document.body.innerHTML = ''
})

const digitar = (campo: Element) => campo.dispatchEvent(new Event('input', { bubbles: true }))

describe('temDadosNaoSalvos', () => {
  it('é falso enquanto ninguém mexeu nos formulários', () => {
    document.body.innerHTML = '<form><input name="titulo" /></form>'
    expect(temDadosNaoSalvos()).toBe(false)
  })

  it('é verdadeiro depois de digitar num campo de formulário', () => {
    document.body.innerHTML = '<form><input name="titulo" /></form>'
    digitar(document.querySelector('input')!)
    expect(temDadosNaoSalvos()).toBe(true)
  })

  it('ignora campos fora de um formulário (ex.: busca, filtros)', () => {
    document.body.innerHTML = '<input name="busca" />'
    digitar(document.querySelector('input')!)
    expect(temDadosNaoSalvos()).toBe(false)
  })

  it('conta opções do Radix, que mudam com clique', () => {
    document.body.innerHTML = '<form><button type="button" role="radio">Sim</button><button type="button">Voltar</button></form>'
    document.querySelectorAll('button')[1].click()
    expect(temDadosNaoSalvos()).toBe(false)
    document.querySelector<HTMLButtonElement>('[role="radio"]')!.click()
    expect(temDadosNaoSalvos()).toBe(true)
  })

  it('esquece o formulário que saiu da tela (salvo ou abandonado)', () => {
    document.body.innerHTML = '<form><input name="titulo" /></form>'
    digitar(document.querySelector('input')!)
    document.querySelector('form')!.remove()
    expect(temDadosNaoSalvos()).toBe(false)
  })
})
