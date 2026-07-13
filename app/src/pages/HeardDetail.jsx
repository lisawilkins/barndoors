import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

export default function HeardDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    navigate(`/heard?expand=${id}`, { replace: true })
  }, [id, navigate])

  return null
}
