import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export default function HerdDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    navigate(`/herd?expand=${id}`, { replace: true })
  }, [id, navigate])

  return null
}
