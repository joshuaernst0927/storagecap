import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function Dashboard() {
  const router = useRouter()
  useEffect(() => { router.replace('/pipeline') }, [router])
  return null
}
