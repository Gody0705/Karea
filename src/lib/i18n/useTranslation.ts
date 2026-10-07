'use client'

import fr from './dictionaries/fr.json'
import en from './dictionaries/en.json'
import { useState, useCallback } from 'react'

type Language = 'fr' | 'en'
const dictionaries = { fr, en }

export function useTranslation(defaultLang: Language = 'fr') {
  const [lang, setLang] = useState<Language>(defaultLang)
  const dict = dictionaries[lang]

  const t = useCallback(
    (keyPath: string, variables?: Record<string, string | number>): string => {
      const keys = keyPath.split('.')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let current: any = dict

      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k]
        } else {
          return keyPath
        }
      }

      if (typeof current !== 'string') {
        return keyPath
      }

      let result = current
      if (variables) {
        Object.entries(variables).forEach(([vKey, vVal]) => {
          result = result.replace(new RegExp(`{{${vKey}}}`, 'g'), String(vVal))
        })
      }

      return result
    },
    [dict]
  )

  return { t, lang, setLang }
}
