import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Room, Participant } from '../types'

interface UseRoomOptions {
  roomCode: string
  onRoomUpdate?: (room: Room) => void
  onParticipantJoin?: (participant: Participant) => void
  onParticipantLeave?: (participant: Participant) => void
}

export function useRoom({ roomCode, onRoomUpdate, onParticipantJoin, onParticipantLeave }: UseRoomOptions) {
  const [room, setRoom] = useState<Room | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Usar refs para os callbacks para evitar re-subscriptions
  const onRoomUpdateRef = useRef(onRoomUpdate)
  const onParticipantJoinRef = useRef(onParticipantJoin)
  const onParticipantLeaveRef = useRef(onParticipantLeave)

  // Atualizar refs quando callbacks mudarem
  useEffect(() => {
    onRoomUpdateRef.current = onRoomUpdate
    onParticipantJoinRef.current = onParticipantJoin
    onParticipantLeaveRef.current = onParticipantLeave
  }, [onRoomUpdate, onParticipantJoin, onParticipantLeave])

  // Atualizar status da sala
  const updateRoomStatus = useCallback(async (status: Room['status']) => {
    if (!room) return

    const { error } = await supabase
      .from('rooms')
      .update({ status })
      .eq('id', room.id)

    if (error) {
      setError('Erro ao atualizar sala')
    }
  }, [room])

  // Avançar pergunta
  const nextQuestion = useCallback(async () => {
    if (!room) return

    const { error } = await supabase
      .from('rooms')
      .update({ current_question_index: room.current_question_index + 1 })
      .eq('id', room.id)

    if (error) {
      setError('Erro ao avançar pergunta')
    }
  }, [room])

  // Buscar participantes
  const fetchParticipants = useCallback(async (roomId: string) => {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('room_id', roomId)
      .order('last_active', { ascending: true })

    if (!error && data) {
      setParticipants(data as Participant[])
    }
  }, [])

  // Setup inicial e subscriptions
  useEffect(() => {
    let roomSubscription: ReturnType<typeof supabase.channel> | null = null
    let participantsSubscription: ReturnType<typeof supabase.channel> | null = null
    let pollingInterval: NodeJS.Timeout | null = null
    let isMounted = true
    let currentRoomId: string | null = null

    const setup = async () => {
      if (!roomCode) return

      setLoading(true)

      // Buscar sala
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()

      if (roomError || !roomData) {
        if (isMounted) {
          setError('Sala não encontrada')
          setLoading(false)
        }
        return
      }

      if (isMounted) {
        setRoom(roomData as Room)
        currentRoomId = roomData.id
      }

      // Buscar participantes
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('room_id', roomData.id)
        .order('last_active', { ascending: true })

      if (isMounted && participantsData) {
        setParticipants(participantsData as Participant[])
        setLoading(false)
      }

      // Polling como fallback para Realtime (a cada 3 segundos)
      pollingInterval = setInterval(async () => {
        if (!isMounted || !currentRoomId) return

        // Buscar participantes atualizados
        const { data: updatedParticipants } = await supabase
          .from('participants')
          .select('*')
          .eq('room_id', currentRoomId)
          .order('last_active', { ascending: true })

        if (updatedParticipants && isMounted) {
          setParticipants(updatedParticipants as Participant[])
        }

        // Buscar sala atualizada
        const { data: updatedRoom } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', currentRoomId)
          .single()

        if (updatedRoom && isMounted) {
          setRoom(updatedRoom as Room)
        }
      }, 3000)

      // Subscribe para mudanças na sala (Realtime ainda pode funcionar)
      roomSubscription = supabase
        .channel(`room-changes-${roomData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomData.id}`,
          },
          (payload) => {
            if (isMounted) {
              const updatedRoom = payload.new as Room
              setRoom(updatedRoom)
              onRoomUpdateRef.current?.(updatedRoom)
            }
          }
        )
        .subscribe()

      // Subscribe para mudanças nos participantes
      participantsSubscription = supabase
        .channel(`participants-changes-${roomData.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'participants',
            filter: `room_id=eq.${roomData.id}`,
          },
          (payload) => {
            if (isMounted) {
              const newParticipant = payload.new as Participant
              setParticipants((prev) => {
                // Evitar duplicatas
                if (prev.some(p => p.id === newParticipant.id)) return prev
                return [...prev, newParticipant]
              })
              onParticipantJoinRef.current?.(newParticipant)
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'participants',
            filter: `room_id=eq.${roomData.id}`,
          },
          (payload) => {
            if (isMounted) {
              const updatedParticipant = payload.new as Participant
              setParticipants((prev) =>
                prev.map((p) => (p.id === updatedParticipant.id ? updatedParticipant : p))
              )
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'participants',
            filter: `room_id=eq.${roomData.id}`,
          },
          (payload) => {
            if (isMounted) {
              const deletedParticipant = payload.old as Participant
              setParticipants((prev) => prev.filter((p) => p.id !== deletedParticipant.id))
              onParticipantLeaveRef.current?.(deletedParticipant)
            }
          }
        )
        .subscribe()
    }

    setup()

    return () => {
      isMounted = false
      if (pollingInterval) {
        clearInterval(pollingInterval)
      }
      if (roomSubscription) {
        supabase.removeChannel(roomSubscription)
      }
      if (participantsSubscription) {
        supabase.removeChannel(participantsSubscription)
      }
    }
  }, [roomCode])

  return {
    room,
    participants,
    loading,
    error,
    updateRoomStatus,
    nextQuestion,
    refetchParticipants: () => room && fetchParticipants(room.id),
  }
}
