'use client'

import { createContext, useContext } from 'react'

export const NavCtx = createContext<{ openNav: () => void }>({ openNav: () => {} })
export const useMobileNav = () => useContext(NavCtx)
