#define SS_WATCHMAN 1
#define SS_CONFESSOR 2
#define SS_KNIGHT 3
#define SS_ATTENDANT 4
#define SS_STEWARD 5
#define SS_HAND 6
#define SS_CONSORT 7
#define SS_SOVEREIGN 8

#define SS_PHASE_LOBBY "lobby"
#define SS_PHASE_PLAYING "playing"
#define SS_PHASE_ROUND_END "round_end"
#define SS_PHASE_MATCH_END "match_end"

#define SS_MAX_SEATS 4
#define SS_MAX_HISTORY 80
#define SS_RESETTIME (20 SECONDS)
#define SS_PACKTIME (10 SECONDS)

#define SS_SOUND_NOTIFY 'sound/chess/notify.ogg'
#define SS_SOUND_SHUFFLE 'sound/items/cardshuffle.ogg'
#define SS_SOUND_PLAY 'sound/items/book_page.ogg'
#define SS_SOUND_DISCARD 'sound/foley/dropsound/paper_drop.ogg'
#define SS_SOUND_ELIMINATE 'sound/chess/capture.ogg'
#define SS_SOUND_SEAL 'sound/items/inqslip_sealed.ogg'
#define SS_SOUND_WIN 'sound/chess/win.ogg'
#define SS_SOUND_LOSS 'sound/chess/loss.ogg'
#define SS_SOUND_RESET 'sound/chess/sbor_chess.ogg'
#define SS_SOUND_PACK 'sound/chess/pick_up_chess.ogg'

/obj/item/scarlet_seal_box
	name = "Scarlet Seal card case"
	desc = "A velvet-lined walnut case holding a sixteen-card court deck and crimson wax Seals of Favor, for two to four players."
	icon = 'icons/roguetown/items/cards/scarlet_seal.dmi'
	icon_state = "scarlet_seal_box"
	w_class = WEIGHT_CLASS_SMALL
	grid_width = 32
	grid_height = 32

/obj/item/scarlet_seal_box/get_mechanics_examine(mob/user)
	. = ..()
	. += span_info("Use the case in hand to lay out the Scarlet Seal card mat in front of you.")

/obj/item/scarlet_seal_box/attack_self(mob/user)
	. = ..()
	var/turf/target = get_step(user, user.dir)
	if(!target || target.density)
		target = get_turf(user)
	new /obj/structure/scarlet_seal(target)
	playsound(target, SS_SOUND_SHUFFLE, 60, TRUE)
	user.visible_message(span_notice("[user] lays out the Scarlet Seal card mat."), span_notice("You lay out the Scarlet Seal card mat."))
	qdel(src)

/datum/scarlet_seal_seat
	var/index = 1
	var/color_key = "red"
	var/ckey
	var/name
	var/seals = 0
	var/list/hand = list()
	var/list/discards = list()
	var/eliminated = FALSE
	var/protected = FALSE
	var/private_note
	var/peek_card = 0
	var/peek_target_name
	var/peek_label
	var/peek_seq = 0

/datum/scarlet_seal_seat/New(seat_index, seat_color)
	. = ..()
	index = seat_index
	color_key = seat_color

/datum/scarlet_seal_seat/proc/set_intel(label, note, card_val, target_name)
	peek_seq++
	peek_label = label
	private_note = note
	peek_card = card_val
	peek_target_name = target_name

/datum/scarlet_seal_seat/proc/clear_round()
	hand = list()
	discards = list()
	eliminated = FALSE
	protected = FALSE
	private_note = null
	peek_card = 0
	peek_target_name = null
	peek_label = null

/datum/scarlet_seal_seat/proc/clear_seat()
	ckey = null
	name = null
	seals = 0
	clear_round()

/datum/scarlet_seal_seat/proc/discard_sum()
	. = 0
	for(var/card_val in discards)
		. += card_val

/obj/structure/scarlet_seal
	name = "Scarlet Seal table"
	desc = "A crimson velvet card mat set for a game of Scarlet Seal, complete with courtier cards and wax Seals of Favor."
	icon = 'icons/roguetown/items/cards/scarlet_seal.dmi'
	icon_state = "scarlet_seal_table"
	anchored = TRUE
	density = FALSE
	layer = OBJ_LAYER
	/// Four seats around the card mat
	var/list/datum/scarlet_seal_seat/seats = list()
	/// Current match phase (lobby, playing, round_end, match_end)
	var/phase = SS_PHASE_LOBBY
	/// Current round number in the match
	var/round_num = 0
	/// Seals of Favor required to win the match (7 for 2p, 5 for 3p, 4 for 4p)
	var/seals_to_win = 4
	/// Index (1..4) of the seat whose turn it currently is
	var/turn_seat = 0
	/// Remaining face-down draw deck (index 1 is top of deck)
	var/list/deck = list()
	/// Single card removed face-down at round start (drawn only if a Steward empties the deck)
	var/set_aside_hidden = 0
	/// Three cards removed face-up at round start in 2-player games
	var/list/set_aside_open = list()
	/// Seat indices that won the most recent round
	var/list/last_winners = list()
	/// Seat indices that won the match
	var/list/match_winners = list()
	/// Whether remaining hands were publicly revealed by deck exhaustion
	var/showdown = FALSE
	/// Outcome text for the most recently completed round
	var/round_summary
	/// Latest notable event displayed in the status panel
	var/message
	/// Chronicle of match events
	var/list/history = list()
	/// Reset request tracking
	var/reset_ckey
	var/reset_name
	var/reset_timer
	/// Mat rotation in degrees
	var/spin = 0

/obj/structure/scarlet_seal/Initialize(mapload)
	. = ..()
	var/list/colors = list("red", "blue", "green", "amber")
	for(var/i in 1 to SS_MAX_SEATS)
		seats += new /datum/scarlet_seal_seat(i, colors[i])

/obj/structure/scarlet_seal/Destroy()
	deltimer(reset_timer)
	QDEL_LIST(seats)
	return ..()

/obj/structure/scarlet_seal/get_mechanics_examine(mob/user)
	. = ..()
	. += span_info("Use the card mat with an empty hand to sit down or spectate.")
	. += span_info("Right click the mat to rotate it.")
	. += span_info("Supports 2 to 4 players in a sixteen-card game of court intrigue.")
	. += span_info("Pack the cards back into their case once no match is in progress.")

/obj/structure/scarlet_seal/attack_hand(mob/user)
	ui_interact(user)
	return TRUE

/obj/structure/scarlet_seal/attack_ghost(mob/dead/observer/user)
	if(!in_range(src, user))
		return ..()
	ui_interact(user)
	return TRUE

/obj/structure/scarlet_seal/attack_right(mob/user)
	if(!user.canUseTopic(src, be_close = TRUE))
		return ..()
	spin = (spin + 90) % 360
	transform = turn(matrix(), spin)
	to_chat(user, span_notice("You rotate the card mat."))
	return TRUE

/obj/structure/scarlet_seal/update_icon_state()
	icon_state = (phase == SS_PHASE_PLAYING || phase == SS_PHASE_ROUND_END) ? "scarlet_seal_table_active" : "scarlet_seal_table"
	return ..()

/obj/structure/scarlet_seal/ui_interact(mob/user, datum/tgui/ui)
	ui = SStgui.try_update_ui(user, src, ui)
	if(!ui)
		ui = new(user, src, "ScarletSeal", name)
		ui.open()

/obj/structure/scarlet_seal/ui_data(mob/user)
	var/list/viewers = onlookers()
	var/datum/scarlet_seal_seat/my_seat = seat_for(user)
	var/list/seat_data = list()
	var/reveal_showdown = showdown && (phase == SS_PHASE_ROUND_END || phase == SS_PHASE_MATCH_END)
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		var/is_mine = !!S.ckey && S.ckey == user.ckey
		var/can_see_hand = is_mine || (reveal_showdown && !S.eliminated)
		seat_data += list(list(
			"index" = S.index,
			"color" = S.color_key,
			"name" = S.name,
			"mine" = is_mine,
			"away" = !!S.ckey && !(S.ckey in viewers),
			"seals" = S.seals,
			"hand" = can_see_hand ? S.hand.Copy() : list(),
			"hand_count" = length(S.hand),
			"discards" = S.discards.Copy(),
			"discard_sum" = S.discard_sum(),
			"eliminated" = S.eliminated,
			"protected" = S.protected,
			"is_turn" = (phase == SS_PHASE_PLAYING && turn_seat == S.index),
			"round_winner" = (S.index in last_winners),
			"match_winner" = (S.index in match_winners),
		))

	var/list/seated = seated_list()
	var/seated_count = length(seated)
	var/preview_target = target_seals_for(max(2, seated_count))
	var/is_my_turn = (phase == SS_PHASE_PLAYING && my_seat && my_seat.index == turn_seat && !my_seat.eliminated)

	var/list/targets_by_card = list()
	var/forced_consort = FALSE
	if(is_my_turn)
		forced_consort = must_discard_consort(my_seat)
		for(var/card_val in my_seat.hand)
			var/key = "[card_val]"
			if(!(key in targets_by_card))
				targets_by_card[key] = valid_targets(my_seat, card_val)

	var/status = "Take a seat to begin."
	switch(phase)
		if(SS_PHASE_LOBBY)
			if(seated_count < 2)
				status = "Waiting for courtiers ([seated_count]/2 minimum)."
			else
				status = "[seated_count] courtiers seated — ready to deal."
		if(SS_PHASE_PLAYING)
			var/datum/scarlet_seal_seat/active_seat = (turn_seat >= 1 && turn_seat <= length(seats)) ? seats[turn_seat] : null
			status = active_seat ? "[active_seat.name]'s turn (Round [round_num])." : "Round [round_num] in progress."
		if(SS_PHASE_ROUND_END)
			status = round_summary || "Round [round_num] complete."
		if(SS_PHASE_MATCH_END)
			status = message || "Match complete."

	var/list/private_intel = null
	if(my_seat?.private_note)
		private_intel = list(
			"seq" = my_seat.peek_seq,
			"label" = my_seat.peek_label,
			"note" = my_seat.private_note,
			"card" = my_seat.peek_card,
			"target" = my_seat.peek_target_name,
		)

	return list(
		"phase" = phase,
		"round" = round_num,
		"seals_to_win" = (phase == SS_PHASE_LOBBY) ? preview_target : seals_to_win,
		"seated_count" = seated_count,
		"seats" = seat_data,
		"my_seat" = my_seat?.index || 0,
		"my_turn" = is_my_turn,
		"forced_consort" = forced_consort,
		"targets_by_card" = targets_by_card,
		"deck_count" = length(deck),
		"has_hidden_card" = !!set_aside_hidden,
		"set_aside_open" = set_aside_open.Copy(),
		"showdown" = showdown,
		"round_summary" = round_summary,
		"status" = status,
		"message" = message,
		"history" = history.Copy(),
		"private_intel" = private_intel,
		"can_start" = !!my_seat && (phase == SS_PHASE_LOBBY || phase == SS_PHASE_MATCH_END) && seated_count >= 2,
		"can_next_round" = !!my_seat && phase == SS_PHASE_ROUND_END && seated_count >= 2,
		"can_pack" = can_pack(),
		"reset_name" = reset_name,
		"reset_left" = reset_timer ? CEILING(timeleft(reset_timer) / 10, 1) : 0,
		"can_answer_reset" = !!reset_ckey && !reset_timer && !!my_seat && reset_ckey != user.ckey,
		"can_cancel_reset" = !!reset_ckey && (!!my_seat || reset_ckey == user.ckey),
	)

/obj/structure/scarlet_seal/ui_act(action, list/params, datum/tgui/ui, datum/ui_state/state)
	. = ..()
	if(.)
		return
	var/mob/user = usr
	if(!user.canUseTopic(src, be_close = TRUE))
		return FALSE
	var/datum/scarlet_seal_seat/my_seat = seat_for(user)
	var/who = user.real_name || user.name

	switch(action)
		if("sit")
			var/idx = text2num(params["seat"])
			if(!idx || idx < 1 || idx > SS_MAX_SEATS)
				return FALSE
			if(my_seat)
				to_chat(user, span_warning("You are already seated at this table."))
				return FALSE
			if(phase == SS_PHASE_PLAYING || phase == SS_PHASE_ROUND_END)
				to_chat(user, span_warning("Wait until the current match ends before taking a seat."))
				return FALSE
			var/datum/scarlet_seal_seat/S = seats[idx]
			if(S.ckey)
				to_chat(user, span_warning("That seat is already taken."))
				return FALSE
			S.ckey = user.ckey
			S.name = who
			drop_reset()
			message = "[who] takes Seat [idx]."
			playsound(src, SS_SOUND_NOTIFY, 50, FALSE)
			return TRUE

		if("stand")
			var/idx = text2num(params["seat"])
			if(!idx || idx < 1 || idx > SS_MAX_SEATS)
				return FALSE
			var/datum/scarlet_seal_seat/S = seats[idx]
			if(!S.ckey)
				return FALSE
			var/is_self = (S.ckey == user.ckey)
			if(!is_self && (S.ckey in onlookers()))
				to_chat(user, span_warning("[S.name] is still at the table."))
				return FALSE
			if(!is_self && !my_seat && (phase == SS_PHASE_PLAYING || phase == SS_PHASE_ROUND_END))
				to_chat(user, span_warning("Only seated players can clear an away courtier mid-match."))
				return FALSE
			var/departing_name = S.name
			var/was_turn = (phase == SS_PHASE_PLAYING && turn_seat == S.index)
			var/was_live = (phase == SS_PHASE_PLAYING || phase == SS_PHASE_ROUND_END)
			if(phase == SS_PHASE_PLAYING && !S.eliminated && length(S.hand))
				var/list/dropped_names = list()
				for(var/card_val in S.hand)
					S.discards += card_val
					dropped_names += "[card_name(card_val)] ([card_val])"
				add_history("[departing_name] leaves the table, discarding [english_list(dropped_names)].")
			else if(was_live)
				add_history("[departing_name] leaves the table.")
			message = is_self ? "[departing_name] rises from the table." : "[who] clears [departing_name] from Seat [idx]."
			S.clear_seat()
			drop_reset()
			if(was_live)
				handle_midmatch_departure(was_turn)
			playsound(src, SS_SOUND_NOTIFY, 50, FALSE)
			update_icon()
			return TRUE

		if("start")
			if(!my_seat || (phase != SS_PHASE_LOBBY && phase != SS_PHASE_MATCH_END))
				return FALSE
			if(length(seated_list()) < 2)
				to_chat(user, span_warning("At least two courtiers must be seated to begin."))
				return FALSE
			start_match()
			return TRUE

		if("next_round")
			if(!my_seat || phase != SS_PHASE_ROUND_END)
				return FALSE
			if(length(seated_list()) < 2)
				to_chat(user, span_warning("At least two courtiers must be seated to deal the next round."))
				return FALSE
			start_round()
			return TRUE

		if("play")
			var/slot = text2num(params["slot"])
			var/target_idx = text2num(params["target"])
			var/guess = text2num(params["guess"])
			return play_card(user, slot, target_idx, guess)

		if("reset")
			if(!my_seat)
				if(reset_ckey)
					to_chat(user, span_warning("A reset has already been requested."))
					return FALSE
				reset_ckey = user.ckey
				reset_name = who
				reset_timer = addtimer(CALLBACK(src, PROC_REF(lapse_reset)), SS_RESETTIME, TIMER_STOPPABLE)
				notify_seated("[who] will reset the Scarlet Seal table and clear all seats in [SS_RESETTIME / 10] seconds unless you cancel it.", user.ckey)
				message = "[who] reaches to gather the cards."
			else if(phase == SS_PHASE_LOBBY || phase == SS_PHASE_MATCH_END)
				wipe_match("[who] resets the table.", FALSE)
			else if(reset_ckey && !reset_timer)
				if(reset_ckey == user.ckey)
					to_chat(user, span_warning("You have already asked to reset the match."))
					return FALSE
				wipe_match("The courtiers agree to reset the match.", FALSE)
			else
				var/other_present = FALSE
				var/list/viewers = onlookers()
				for(var/datum/scarlet_seal_seat/S as anything in seated_list())
					if(S.ckey != user.ckey && (S.ckey in viewers))
						other_present = TRUE
						break
				if(!other_present)
					wipe_match("[who] resets the match.", FALSE)
				else
					deltimer(reset_timer)
					reset_timer = null
					reset_ckey = user.ckey
					reset_name = who
					notify_seated("[who] asks to reset the Scarlet Seal match.", user.ckey)
					message = "[who] asks to reset the match."
			playsound(src, SS_SOUND_NOTIFY, 50, FALSE)
			return TRUE

		if("cancel_reset")
			if(!reset_ckey || (reset_ckey != user.ckey && !my_seat))
				return FALSE
			message = "[who] calls off the reset."
			drop_reset()
			playsound(src, SS_SOUND_NOTIFY, 50, FALSE)
			return TRUE

		if("pack")
			if(!can_pack())
				to_chat(user, span_warning("The cards can only be packed away when no match is in progress."))
				return FALSE
			notify_seated("[who] is packing up the Scarlet Seal set.", user.ckey)
			user.visible_message(span_notice("[user] begins gathering the Scarlet Seal cards into their case."), span_notice("You begin packing up the Scarlet Seal set."))
			if(!do_after(user, SS_PACKTIME, target = src) || QDELETED(src) || !can_pack())
				to_chat(user, span_warning("You stop packing up the cards."))
				return FALSE
			playsound(src, SS_SOUND_PACK, 70, FALSE)
			new /obj/item/scarlet_seal_box(loc)
			user.visible_message(span_notice("[user] packs the Scarlet Seal set away into its velvet case."), span_notice("You pack the Scarlet Seal set away."))
			qdel(src)
			return FALSE

	return FALSE

/obj/structure/scarlet_seal/proc/card_name(card_val)
	switch(card_val)
		if(SS_WATCHMAN)
			return "Watchman"
		if(SS_CONFESSOR)
			return "Confessor"
		if(SS_KNIGHT)
			return "Knight"
		if(SS_ATTENDANT)
			return "Attendant"
		if(SS_STEWARD)
			return "Steward"
		if(SS_HAND)
			return "Hand"
		if(SS_CONSORT)
			return "Consort"
		if(SS_SOVEREIGN)
			return "Sovereign"
	return "Unknown"

/obj/structure/scarlet_seal/proc/target_seals_for(player_count)
	switch(player_count)
		if(2)
			return 7
		if(3)
			return 5
		else
			return 4

/obj/structure/scarlet_seal/proc/build_deck()
	return shuffle(list(
		SS_WATCHMAN, SS_WATCHMAN, SS_WATCHMAN, SS_WATCHMAN, SS_WATCHMAN,
		SS_CONFESSOR, SS_CONFESSOR,
		SS_KNIGHT, SS_KNIGHT,
		SS_ATTENDANT, SS_ATTENDANT,
		SS_STEWARD, SS_STEWARD,
		SS_HAND,
		SS_CONSORT,
		SS_SOVEREIGN,
	))

/obj/structure/scarlet_seal/proc/seated_list()
	. = list()
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		if(S.ckey)
			. += S

/obj/structure/scarlet_seal/proc/active_list()
	. = list()
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		if(S.ckey && !S.eliminated)
			. += S

/obj/structure/scarlet_seal/proc/seat_for(mob/user)
	var/ckey = user?.ckey
	if(!ckey)
		return null
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		if(S.ckey == ckey)
			return S
	return null

/obj/structure/scarlet_seal/proc/onlookers()
	. = list()
	for(var/datum/tgui/ui as anything in open_uis)
		if(ui.user?.ckey)
			. |= ui.user.ckey

/obj/structure/scarlet_seal/proc/notify_seated(text, exclude)
	for(var/datum/scarlet_seal_seat/S as anything in seated_list())
		if(S.ckey == exclude)
			continue
		var/client/C = GLOB.directory[S.ckey]
		if(C)
			to_chat(C.mob, span_warning(text))

/obj/structure/scarlet_seal/proc/add_history(entry)
	history += entry
	if(length(history) > SS_MAX_HISTORY)
		history.Cut(1, length(history) - SS_MAX_HISTORY + 1)

/obj/structure/scarlet_seal/proc/can_pack()
	return phase == SS_PHASE_LOBBY || phase == SS_PHASE_MATCH_END

/obj/structure/scarlet_seal/proc/drop_reset()
	reset_ckey = null
	reset_name = null
	deltimer(reset_timer)
	reset_timer = null

/obj/structure/scarlet_seal/proc/lapse_reset()
	reset_timer = null
	wipe_match("[reset_name] resets the table and clears all seats.", TRUE)

/obj/structure/scarlet_seal/proc/wipe_match(text, unseat = FALSE)
	drop_reset()
	if(unseat)
		for(var/datum/scarlet_seal_seat/S as anything in seats)
			S.clear_seat()
	else
		for(var/datum/scarlet_seal_seat/S as anything in seats)
			S.seals = 0
			S.clear_round()
	phase = SS_PHASE_LOBBY
	round_num = 0
	turn_seat = 0
	deck = list()
	set_aside_hidden = 0
	set_aside_open = list()
	last_winners = list()
	match_winners = list()
	showdown = FALSE
	round_summary = null
	history = list()
	message = text
	playsound(src, SS_SOUND_RESET, 65, FALSE)
	update_icon()
	SStgui.update_uis(src)

/obj/structure/scarlet_seal/proc/draw_card()
	if(!length(deck))
		return 0
	var/card_val = deck[1]
	deck.Cut(1, 2)
	return card_val

/obj/structure/scarlet_seal/proc/draw_card_for_steward()
	if(length(deck))
		return draw_card()
	if(set_aside_hidden)
		var/card_val = set_aside_hidden
		set_aside_hidden = 0
		add_history("The deck is empty — the face-down set-aside card is drawn.")
		return card_val
	return 0

/obj/structure/scarlet_seal/proc/must_discard_consort(datum/scarlet_seal_seat/S)
	return (SS_CONSORT in S.hand) && ((SS_HAND in S.hand) || (SS_STEWARD in S.hand))

/obj/structure/scarlet_seal/proc/valid_targets(datum/scarlet_seal_seat/actor, card_val)
	. = list()
	switch(card_val)
		if(SS_WATCHMAN, SS_CONFESSOR, SS_KNIGHT, SS_HAND)
			for(var/datum/scarlet_seal_seat/T as anything in seats)
				if(T.ckey && !T.eliminated && T != actor && !T.protected)
					. += T.index
		if(SS_STEWARD)
			for(var/datum/scarlet_seal_seat/T as anything in seats)
				if(T.ckey && !T.eliminated && (T == actor || !T.protected))
					. += T.index

/obj/structure/scarlet_seal/proc/start_match()
	var/list/datum/scarlet_seal_seat/seated = seated_list()
	if(length(seated) < 2)
		return
	drop_reset()
	seals_to_win = target_seals_for(length(seated))
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		S.seals = 0
		S.clear_round()
	round_num = 0
	last_winners = list()
	match_winners = list()
	history = list()
	add_history("A new match begins! First to [seals_to_win] Seals of Favor wins.")
	start_round()

/obj/structure/scarlet_seal/proc/start_round()
	var/list/datum/scarlet_seal_seat/seated = seated_list()
	if(length(seated) < 2)
		phase = SS_PHASE_LOBBY
		update_icon()
		return
	round_num++
	showdown = FALSE
	round_summary = null
	set_aside_open = list()
	set_aside_hidden = 0
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		S.clear_round()

	deck = build_deck()
	set_aside_hidden = draw_card()
	if(length(seated) == 2)
		for(var/i in 1 to 3)
			set_aside_open += draw_card()
	for(var/datum/scarlet_seal_seat/S as anything in seated)
		S.hand += draw_card()

	var/list/valid_prev_winners = list()
	for(var/w_idx in last_winners)
		var/datum/scarlet_seal_seat/W = seats[w_idx]
		if(W.ckey)
			valid_prev_winners += w_idx
	var/first_idx = 0
	if(length(valid_prev_winners))
		first_idx = pick(valid_prev_winners)
	else
		var/datum/scarlet_seal_seat/first_seat = pick(seated)
		first_idx = first_seat.index

	last_winners = list()
	phase = SS_PHASE_PLAYING
	turn_seat = first_idx
	var/datum/scarlet_seal_seat/starter = seats[first_idx]
	add_history("— Round [round_num] begins. [starter.name] goes first. —")
	if(length(set_aside_open))
		var/list/open_labels = list()
		for(var/card_val in set_aside_open)
			open_labels += "[card_name(card_val)] ([card_val])"
		add_history("Set aside face-up: [english_list(open_labels)].")
	playsound(src, SS_SOUND_SHUFFLE, 65, FALSE)
	begin_turn(starter)
	update_icon()

/obj/structure/scarlet_seal/proc/begin_turn(datum/scarlet_seal_seat/S)
	S.protected = FALSE
	var/drawn = draw_card()
	if(drawn)
		S.hand += drawn
	message = "It is [S.name]'s turn."

/obj/structure/scarlet_seal/proc/eliminate_seat(datum/scarlet_seal_seat/victim)
	victim.eliminated = TRUE
	victim.protected = FALSE
	var/list/dropped = list()
	while(length(victim.hand))
		var/card_val = victim.hand[1]
		victim.hand.Cut(1, 2)
		victim.discards += card_val
		dropped += "[card_name(card_val)] ([card_val])"
	if(length(dropped))
		add_history("[victim.name] is knocked out and discards [english_list(dropped)].")
	else
		add_history("[victim.name] is knocked out of the round.")
	playsound(src, SS_SOUND_ELIMINATE, 60, FALSE)

/obj/structure/scarlet_seal/proc/play_card(mob/user, slot, target_idx, guess)
	if(phase != SS_PHASE_PLAYING)
		return FALSE
	var/datum/scarlet_seal_seat/actor = seat_for(user)
	if(!actor || actor.index != turn_seat || actor.eliminated)
		to_chat(user, span_warning("It is not your turn."))
		return FALSE
	if(!slot || slot < 1 || slot > length(actor.hand))
		return FALSE
	var/card_val = actor.hand[slot]
	if(must_discard_consort(actor) && card_val != SS_CONSORT)
		to_chat(user, span_warning("You must discard the Consort when holding the Hand or Steward."))
		return FALSE

	var/list/targets = valid_targets(actor, card_val)
	var/datum/scarlet_seal_seat/target = null
	if(card_val in list(SS_WATCHMAN, SS_CONFESSOR, SS_KNIGHT, SS_STEWARD, SS_HAND))
		if(length(targets))
			if(!(target_idx in targets))
				to_chat(user, span_warning("Choose a valid target for [card_name(card_val)]."))
				return FALSE
			target = seats[target_idx]
		if(card_val == SS_WATCHMAN && target)
			if(!guess || guess < SS_CONFESSOR || guess > SS_SOVEREIGN)
				to_chat(user, span_warning("Name a role other than Watchman (2–8)."))
				return FALSE

	// Discard the chosen card face-up in front of the player
	actor.hand.Cut(slot, slot + 1)
	actor.discards += card_val
	playsound(src, SS_SOUND_PLAY, 55, FALSE)

	switch(card_val)
		if(SS_SOVEREIGN)
			add_history("[actor.name] discards Sovereign (8) — their missive is cast into the hearth!")
			eliminate_seat(actor)

		if(SS_CONSORT)
			add_history("[actor.name] discards Consort (7).")

		if(SS_ATTENDANT)
			actor.protected = TRUE
			add_history("[actor.name] plays Attendant (4) and is shielded from other cards until their next turn.")

		if(SS_WATCHMAN)
			if(!target)
				add_history("[actor.name] discards Watchman (1) without effect (all other courtiers are protected).")
			else if(length(target.hand) && target.hand[1] == guess)
				add_history("[actor.name] plays Watchman (1) on [target.name], naming [card_name(guess)] ([guess]) — correct!")
				eliminate_seat(target)
			else
				add_history("[actor.name] plays Watchman (1) on [target.name], naming [card_name(guess)] ([guess]) — no match.")

		if(SS_CONFESSOR)
			if(!target)
				add_history("[actor.name] discards Confessor (2) without effect (all other courtiers are protected).")
			else
				var/seen = length(target.hand) ? target.hand[1] : 0
				actor.set_intel("Confessor's Inquiry", "You secretly viewed [target.name]'s hand: [card_name(seen)] ([seen]).", seen, target.name)
				add_history("[actor.name] plays Confessor (2) and secretly inspects [target.name]'s hand.")

		if(SS_KNIGHT)
			if(!target)
				add_history("[actor.name] discards Knight (3) without effect (all other courtiers are protected).")
			else
				var/my_card = length(actor.hand) ? actor.hand[1] : 0
				var/their_card = length(target.hand) ? target.hand[1] : 0
				if(my_card > their_card)
					actor.set_intel("Knight's Challenge", "Your [card_name(my_card)] ([my_card]) beat [target.name]'s [card_name(their_card)] ([their_card]).", their_card, target.name)
					target.set_intel("Knight's Challenge", "[actor.name]'s [card_name(my_card)] ([my_card]) beat your [card_name(their_card)] ([their_card]).", my_card, actor.name)
					add_history("[actor.name] plays Knight (3) against [target.name] — [target.name] holds the lower card!")
					eliminate_seat(target)
				else if(their_card > my_card)
					actor.set_intel("Knight's Challenge", "[target.name]'s [card_name(their_card)] ([their_card]) beat your [card_name(my_card)] ([my_card]).", their_card, target.name)
					target.set_intel("Knight's Challenge", "Your [card_name(their_card)] ([their_card]) beat [actor.name]'s [card_name(my_card)] ([my_card]).", my_card, actor.name)
					add_history("[actor.name] plays Knight (3) against [target.name] — [actor.name] holds the lower card!")
					eliminate_seat(actor)
				else
					actor.set_intel("Knight's Challenge", "You and [target.name] both hold [card_name(my_card)] ([my_card]) — a tie!", their_card, target.name)
					target.set_intel("Knight's Challenge", "You and [actor.name] both hold [card_name(my_card)] ([my_card]) — a tie!", my_card, actor.name)
					add_history("[actor.name] plays Knight (3) against [target.name] — tied hands! Nothing happens.")

		if(SS_STEWARD)
			var/discarded = length(target.hand) ? target.hand[1] : 0
			target.hand = list()
			if(discarded)
				target.discards += discarded
			var/target_desc = (target == actor) ? "themself" : target.name
			if(discarded == SS_SOVEREIGN)
				add_history("[actor.name] plays Steward (5) on [target_desc], forcing [target.name] to discard Sovereign (8)!")
				eliminate_seat(target)
			else
				var/drawn = draw_card_for_steward()
				if(drawn)
					target.hand += drawn
				add_history("[actor.name] plays Steward (5) on [target_desc]. [target.name] discards [card_name(discarded)] ([discarded]) and draws a new card.")
				playsound(src, SS_SOUND_DISCARD, 55, FALSE)

		if(SS_HAND)
			if(!target)
				add_history("[actor.name] discards Hand (6) without effect (all other courtiers are protected).")
			else
				var/my_card = length(actor.hand) ? actor.hand[1] : 0
				var/their_card = length(target.hand) ? target.hand[1] : 0
				actor.hand = their_card ? list(their_card) : list()
				target.hand = my_card ? list(my_card) : list()
				actor.set_intel("Hand's Decree", "You traded your [card_name(my_card)] ([my_card]) to [target.name] and received [card_name(their_card)] ([their_card]).", my_card, target.name)
				target.set_intel("Hand's Decree", "[actor.name] traded their [card_name(my_card)] ([my_card]) for your [card_name(their_card)] ([their_card]).", their_card, actor.name)
				add_history("[actor.name] plays Hand (6) and trades hands with [target.name].")

	advance_or_end_round()
	return TRUE

/obj/structure/scarlet_seal/proc/advance_or_end_round()
	var/list/datum/scarlet_seal_seat/alive = active_list()
	if(length(alive) <= 1)
		finish_round(alive, FALSE)
		return

	if(!length(deck))
		var/best_hand = -1
		var/list/datum/scarlet_seal_seat/tied = list()
		for(var/datum/scarlet_seal_seat/S as anything in alive)
			var/val = length(S.hand) ? S.hand[1] : 0
			if(val > best_hand)
				best_hand = val
				tied = list(S)
			else if(val == best_hand)
				tied += S
		var/list/datum/scarlet_seal_seat/winners = tied
		if(length(tied) > 1)
			var/best_discard = -1
			winners = list()
			for(var/datum/scarlet_seal_seat/S as anything in tied)
				var/dsum = S.discard_sum()
				if(dsum > best_discard)
					best_discard = dsum
					winners = list(S)
				else if(dsum == best_discard)
					winners += S
		finish_round(winners, TRUE)
		return

	for(var/offset in 1 to SS_MAX_SEATS)
		var/next_idx = ((turn_seat - 1 + offset) % SS_MAX_SEATS) + 1
		var/datum/scarlet_seal_seat/candidate = seats[next_idx]
		if(candidate.ckey && !candidate.eliminated)
			turn_seat = next_idx
			begin_turn(candidate)
			return

/obj/structure/scarlet_seal/proc/finish_round(list/datum/scarlet_seal_seat/winners, is_showdown)
	showdown = is_showdown
	turn_seat = 0
	last_winners = list()
	var/list/win_names = list()
	for(var/datum/scarlet_seal_seat/W as anything in winners)
		W.seals++
		last_winners += W.index
		win_names += W.name

	if(is_showdown)
		var/list/reveal_parts = list()
		for(var/datum/scarlet_seal_seat/S as anything in active_list())
			var/val = length(S.hand) ? S.hand[1] : 0
			reveal_parts += "[S.name]: [card_name(val)] ([val], discards [S.discard_sum()])"
		add_history("Deck exhausted — Showdown! [english_list(reveal_parts)].")
		if(length(win_names) == 1)
			round_summary = "[win_names[1]] wins Round [round_num] at showdown and claims a Seal of Favor!"
		else
			round_summary = "[english_list(win_names)] tie at showdown and each claim a Seal of Favor!"
	else if(length(win_names) == 1)
		round_summary = "[win_names[1]] is the last courtier standing in Round [round_num] and claims a Seal of Favor!"
	else
		round_summary = "Round [round_num] ends without a winner."

	add_history(round_summary)

	// Check if a courtier has won the match
	var/top_seals = 0
	var/list/datum/scarlet_seal_seat/leaders = list()
	for(var/datum/scarlet_seal_seat/S as anything in seated_list())
		if(S.seals >= seals_to_win)
			if(S.seals > top_seals)
				top_seals = S.seals
				leaders = list(S)
			else if(S.seals == top_seals)
				leaders += S

	if(length(leaders) == 1)
		var/datum/scarlet_seal_seat/champ = leaders[1]
		phase = SS_PHASE_MATCH_END
		match_winners = list(champ.index)
		message = "[champ.name] wins the match with [champ.seals] Seals of Favor!"
		add_history(message)
		play_match_end_sounds(champ.ckey)
	else if(length(leaders) > 1)
		phase = SS_PHASE_ROUND_END
		var/list/tied_names = list()
		for(var/datum/scarlet_seal_seat/L as anything in leaders)
			tied_names += L.name
		message = "[english_list(tied_names)] are tied at [top_seals] Seals of Favor — deal a tiebreaker round!"
		add_history(message)
		playsound(src, SS_SOUND_SEAL, 65, FALSE)
	else
		phase = SS_PHASE_ROUND_END
		message = round_summary
		playsound(src, SS_SOUND_SEAL, 65, FALSE)

	update_icon()

/obj/structure/scarlet_seal/proc/handle_midmatch_departure(was_turn)
	var/list/datum/scarlet_seal_seat/seated = seated_list()
	if(length(seated) < 2)
		if(length(seated) == 1)
			var/datum/scarlet_seal_seat/survivor = seated[1]
			phase = SS_PHASE_MATCH_END
			turn_seat = 0
			match_winners = list(survivor.index)
			message = "[survivor.name] wins by forfeit."
			add_history(message)
			play_match_end_sounds(survivor.ckey)
		else
			phase = SS_PHASE_LOBBY
			turn_seat = 0
			message = "All courtiers have left the table."
		return

	if(phase == SS_PHASE_PLAYING)
		var/list/datum/scarlet_seal_seat/alive = active_list()
		if(length(alive) <= 1)
			finish_round(alive, FALSE)
		else if(was_turn)
			advance_or_end_round()

/obj/structure/scarlet_seal/proc/play_match_end_sounds(winner_ckey)
	var/list/hearers = onlookers()
	for(var/datum/scarlet_seal_seat/S as anything in seated_list())
		hearers |= S.ckey
	for(var/ckey in hearers)
		var/client/C = GLOB.directory[ckey]
		if(!C?.mob)
			continue
		var/is_seated_loser = FALSE
		for(var/datum/scarlet_seal_seat/S as anything in seated_list())
			if(S.ckey == ckey && ckey != winner_ckey)
				is_seated_loser = TRUE
				break
		C.mob.playsound_local(get_turf(C.mob), is_seated_loser ? SS_SOUND_LOSS : SS_SOUND_WIN, 65)

#undef SS_WATCHMAN
#undef SS_CONFESSOR
#undef SS_KNIGHT
#undef SS_ATTENDANT
#undef SS_STEWARD
#undef SS_HAND
#undef SS_CONSORT
#undef SS_SOVEREIGN
#undef SS_PHASE_LOBBY
#undef SS_PHASE_PLAYING
#undef SS_PHASE_ROUND_END
#undef SS_PHASE_MATCH_END
#undef SS_MAX_SEATS
#undef SS_MAX_HISTORY
#undef SS_RESETTIME
#undef SS_PACKTIME
#undef SS_SOUND_NOTIFY
#undef SS_SOUND_SHUFFLE
#undef SS_SOUND_PLAY
#undef SS_SOUND_DISCARD
#undef SS_SOUND_ELIMINATE
#undef SS_SOUND_SEAL
#undef SS_SOUND_WIN
#undef SS_SOUND_LOSS
#undef SS_SOUND_RESET
#undef SS_SOUND_PACK
