import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AudioForm } from './AudioForm'

describe('AudioForm', () => {
  it('normalisiert Namen und Tags beim Speichern', async () => {
    const submit = vi.fn()
    render(<AudioForm title="Import" initial={{ name: '  Feuer  ', type: 'soundEffect', volume: 1, loop: false, tags: [] }} onSubmit={submit} onCancel={() => undefined} />)
    fireEvent.change(screen.getByLabelText(/Tags/), { target: { value: ' Fire, weather, Fire ' } })
    fireEvent.click(screen.getByRole('button', { name: /Speichern/ }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ name: 'Feuer', tags: ['fire', 'weather'] }))
  })
})
