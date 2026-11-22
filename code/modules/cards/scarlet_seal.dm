#define SS_FOOL "fool"
#define SS_CUTTHROAT "cutthroat"
#define SS_WATCHMAN "watchman"
#define SS_CONFESSOR "confessor"
#define SS_INQUISITOR "inquisitor"
#define SS_KNIGHT "knight"
#define SS_SPYMASTER "spymaster"
#define SS_ATTENDANT "attendant"
#define SS_FLATTERER "flatterer"
#define SS_STEWARD "steward"
#define SS_SENESCHAL "seneschal"
#define SS_HAND "hand"
#define SS_WARDEN "warden"
#define SS_CONSORT "consort"
#define SS_MATRIARCH "matriarch"
#define SS_SOVEREIGN "sovereign"
#define SS_PRELATE "prelate"

#define SS_PHASE_LOBBY "lobby"
#define SS_PHASE_PLAYING "playing"
#define SS_PHASE_ROUND_END "round_end"
#define SS_PHASE_MATCH_END "match_end"

#define SS_MAX_SEATS 8
#define SS_MAX_HISTORY 100
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
	desc = "A velvet-lined walnut case holding the full thirty-two-card court deck and crimson wax Seals of Favor, for two to eight players."
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
	var/list/peek_cards = list()
	var/peek_label
	var/peek_seq = 0

/datum/scarlet_seal_seat/New(seat_index, seat_color)
	. = ..()
	index = seat_index
	color_key = seat_color

/datum/scarlet_seal_seat/proc/set_intel(label, note, list/cards_shown)
	peek_seq++
	peek_label = label
	private_note = note
	peek_cards = cards_shown ? cards_shown.Copy() : list()

/datum/scarlet_seal_seat/proc/clear_round()
	hand = list()
	discards = list()
	eliminated = FALSE
	protected = FALSE
	private_note = null
	peek_cards = list()
	peek_label = null

/datum/scarlet_seal_seat/proc/clear_seat()
	ckey = null
	name = null
	seals = 0
	clear_round()

/datum/scarlet_seal_seat/proc/seneschal_count()
	. = 0
	for(var/card_id in discards)
		if(card_id == SS_SENESCHAL)
			.++

/datum/scarlet_seal_seat/proc/has_warden()
	return (SS_WARDEN in discards)

/obj/structure/scarlet_seal
	name = "Scarlet Seal table"
	desc = "A crimson velvet card mat set for a game of Scarlet Seal, complete with courtier cards and wax Seals of Favor for two to eight players."
	icon = 'icons/roguetown/items/cards/scarlet_seal.dmi'
	icon_state = "scarlet_seal_table"
	anchored = TRUE
	density = FALSE
	layer = OBJ_LAYER
	/// Eight seats around the card mat
	var/list/datum/scarlet_seal_seat/seats = list()
	/// Current match phase (lobby, playing, round_end, match_end)
	var/phase = SS_PHASE_LOBBY
	/// Whether the current match uses the 32-card expanded deck (5-8 players)
	var/expanded_deck = FALSE
	/// Current round number in the match
	var/round_num = 0
	/// Seals of Favor required to win the match (7 for 2p, 5 for 3p, 4 for 4-8p)
	var/seals_to_win = 4
	/// Index (1..8) of the seat whose turn it currently is
	var/turn_seat = 0
	/// Seat index forced to be chosen by the next targeting card (Flatterer effect), or 0
	var/flatterer_target = 0
	/// Seat index who played the Fool this round, or 0
	var/fool_owner = 0
	/// Seat index holding the Fool token this round, or 0
	var/fool_target = 0
	/// Seat index deciding whether to keep or redraw after being guessed by Prelate, or 0
	var/pending_prelate_seat = 0
	/// Remaining face-down draw deck (index 1 is top of deck)
	var/list/deck = list()
	/// Single card removed face-down at round start (drawn if Steward/Cutthroat/Prelate empties deck)
	var/set_aside_hidden
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
	var/list/colors = list("red", "blue", "green", "amber", "plum", "teal", "copper", "slate")
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
	. += span_info("Supports 2 to 8 players: 16-card court deck for 2–4 players, expanding to 32 cards for 5–8 players.")
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
			"discard_sum" = seat_discard_sum(S),
			"seneschals" = S.seneschal_count(),
			"has_warden" = S.has_warden(),
			"eliminated" = S.eliminated,
			"protected" = S.protected,
			"flatterer_marked" = (flatterer_target == S.index),
			"fool_marked" = (fool_target == S.index),
			"is_turn" = (phase == SS_PHASE_PLAYING && !pending_prelate_seat && turn_seat == S.index),
			"round_winner" = (S.index in last_winners),
			"match_winner" = (S.index in match_winners),
		))

	var/list/seated = seated_list()
	var/seated_count = length(seated)
	var/preview_expanded = (seated_count >= 5)
	var/preview_target = target_seals_for(max(2, seated_count))
	var/is_my_turn = (phase == SS_PHASE_PLAYING && !pending_prelate_seat && my_seat && my_seat.index == turn_seat && !my_seat.eliminated)

	var/list/targets_by_card = list()
	var/forced_consort = FALSE
	if(is_my_turn)
		forced_consort = must_discard_consort(my_seat)
		for(var/card_id in my_seat.hand)
			if(!(card_id in targets_by_card))
				targets_by_card[card_id] = valid_targets(my_seat, card_id)

	var/status = "Take a seat to begin."
	switch(phase)
		if(SS_PHASE_LOBBY)
			if(seated_count < 2)
				status = "Waiting for courtiers ([seated_count]/2 minimum)."
			else
				status = "[seated_count] courtiers seated ([preview_expanded ? "32-card expanded" : "16-card classic"] deck) — ready to deal."
		if(SS_PHASE_PLAYING)
			if(pending_prelate_seat >= 1 && pending_prelate_seat <= length(seats))
				var/datum/scarlet_seal_seat/PS = seats[pending_prelate_seat]
				status = "Waiting for [PS.name] to keep or redraw their exposed card."
			else
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
			"cards" = my_seat.peek_cards.Copy(),
		)

	var/fool_owner_name = (fool_owner >= 1 && fool_owner <= length(seats)) ? seats[fool_owner].name : null
	var/pending_prelate_name = (pending_prelate_seat >= 1 && pending_prelate_seat <= length(seats)) ? seats[pending_prelate_seat].name : null

	return list(
		"phase" = phase,
		"expanded" = (phase == SS_PHASE_LOBBY) ? preview_expanded : expanded_deck,
		"round" = round_num,
		"seals_to_win" = (phase == SS_PHASE_LOBBY) ? preview_target : seals_to_win,
		"seated_count" = seated_count,
		"seats" = seat_data,
		"my_seat" = my_seat?.index || 0,
		"my_turn" = is_my_turn,
		"forced_consort" = forced_consort,
		"flatterer_target" = flatterer_target,
		"fool_owner_name" = fool_owner_name,
		"pending_prelate_seat" = pending_prelate_seat,
		"pending_prelate_name" = pending_prelate_name,
		"is_my_prelate_choice" = (phase == SS_PHASE_PLAYING && pending_prelate_seat && my_seat && my_seat.index == pending_prelate_seat),
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
			var/was_prelate = (phase == SS_PHASE_PLAYING && pending_prelate_seat == S.index)
			var/was_live = (phase == SS_PHASE_PLAYING || phase == SS_PHASE_ROUND_END)
			if(phase == SS_PHASE_PLAYING && !S.eliminated && length(S.hand))
				var/list/dropped_names = list()
				for(var/card_id in S.hand)
					S.discards += card_id
					dropped_names += card_label(card_id)
				add_history("[departing_name] leaves the table, discarding [english_list(dropped_names)].")
			else if(was_live)
				add_history("[departing_name] leaves the table.")
			if(flatterer_target == S.index)
				flatterer_target = 0
			if(fool_owner == S.index || fool_target == S.index)
				fool_owner = 0
				fool_target = 0
			if(was_prelate)
				pending_prelate_seat = 0
			message = is_self ? "[departing_name] rises from the table." : "[who] clears [departing_name] from Seat [idx]."
			S.clear_seat()
			drop_reset()
			if(was_live)
				handle_midmatch_departure(was_turn || was_prelate)
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
			var/target2_idx = text2num(params["target2"])
			var/peek_idx = text2num(params["peek"])
			var/raw_guess = params["guess"]
			var/guess = isnum(raw_guess) ? raw_guess : (istext(raw_guess) ? text2num(raw_guess) : -1)
			if(isnull(guess))
				guess = -1
			return play_card(user, slot, target_idx, target2_idx, peek_idx, guess)

		if("prelate_choice")
			return handle_prelate_choice(user, params["choice"])

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

/obj/structure/scarlet_seal/proc/card_value(card_id)
	switch(card_id)
		if(SS_FOOL, SS_CUTTHROAT)
			return 0
		if(SS_WATCHMAN)
			return 1
		if(SS_CONFESSOR, SS_INQUISITOR)
			return 2
		if(SS_KNIGHT, SS_SPYMASTER)
			return 3
		if(SS_ATTENDANT, SS_FLATTERER)
			return 4
		if(SS_STEWARD, SS_SENESCHAL)
			return 5
		if(SS_HAND, SS_WARDEN)
			return 6
		if(SS_CONSORT, SS_MATRIARCH)
			return 7
		if(SS_SOVEREIGN)
			return 8
		if(SS_PRELATE)
			return 9
	return 0

/obj/structure/scarlet_seal/proc/card_name(card_id)
	switch(card_id)
		if(SS_FOOL)
			return "Fool"
		if(SS_CUTTHROAT)
			return "Cutthroat"
		if(SS_WATCHMAN)
			return "Watchman"
		if(SS_CONFESSOR)
			return "Confessor"
		if(SS_INQUISITOR)
			return "Inquisitor"
		if(SS_KNIGHT)
			return "Knight"
		if(SS_SPYMASTER)
			return "Spymaster"
		if(SS_ATTENDANT)
			return "Attendant"
		if(SS_FLATTERER)
			return "Flatterer"
		if(SS_STEWARD)
			return "Steward"
		if(SS_SENESCHAL)
			return "Seneschal"
		if(SS_HAND)
			return "Hand"
		if(SS_WARDEN)
			return "Warden"
		if(SS_CONSORT)
			return "Consort"
		if(SS_MATRIARCH)
			return "Matriarch"
		if(SS_SOVEREIGN)
			return "Sovereign"
		if(SS_PRELATE)
			return "Prelate"
	return "Unknown"

/obj/structure/scarlet_seal/proc/card_label(card_id)
	return "[card_name(card_id)] ([card_value(card_id)])"

/obj/structure/scarlet_seal/proc/number_label(num_val)
	if(!expanded_deck)
		switch(num_val)
			if(2)
				return "2 (Confessor)"
			if(3)
				return "3 (Knight)"
			if(4)
				return "4 (Attendant)"
			if(5)
				return "5 (Steward)"
			if(6)
				return "6 (Hand)"
			if(7)
				return "7 (Consort)"
			if(8)
				return "8 (Sovereign)"
	switch(num_val)
		if(0)
			return "0 (Fool / Cutthroat)"
		if(1)
			return "1 (Watchman)"
		if(2)
			return "2 (Confessor / Inquisitor)"
		if(3)
			return "3 (Knight / Spymaster)"
		if(4)
			return "4 (Attendant / Flatterer)"
		if(5)
			return "5 (Steward / Seneschal)"
		if(6)
			return "6 (Hand / Warden)"
		if(7)
			return "7 (Consort / Matriarch)"
		if(8)
			return "8 (Sovereign)"
		if(9)
			return "9 (Prelate)"
	return "[num_val]"

/obj/structure/scarlet_seal/proc/seat_discard_sum(datum/scarlet_seal_seat/S)
	. = 0
	for(var/card_id in S.discards)
		. += card_value(card_id)

/obj/structure/scarlet_seal/proc/target_seals_for(player_count)
	switch(player_count)
		if(2)
			return 7
		if(3)
			return 5
		else
			return 4

/obj/structure/scarlet_seal/proc/build_deck(use_expanded)
	var/list/cards = list(
		SS_WATCHMAN, SS_WATCHMAN, SS_WATCHMAN, SS_WATCHMAN, SS_WATCHMAN,
		SS_CONFESSOR, SS_CONFESSOR,
		SS_KNIGHT, SS_KNIGHT,
		SS_ATTENDANT, SS_ATTENDANT,
		SS_STEWARD, SS_STEWARD,
		SS_HAND,
		SS_CONSORT,
		SS_SOVEREIGN,
	)
	if(use_expanded)
		cards += list(
			SS_FOOL,
			SS_CUTTHROAT,
			SS_WATCHMAN, SS_WATCHMAN, SS_WATCHMAN,
			SS_INQUISITOR, SS_INQUISITOR,
			SS_SPYMASTER, SS_SPYMASTER,
			SS_FLATTERER, SS_FLATTERER,
			SS_SENESCHAL, SS_SENESCHAL,
			SS_WARDEN,
			SS_MATRIARCH,
			SS_PRELATE,
		)
	return shuffle(cards)

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
	expanded_deck = FALSE
	round_num = 0
	turn_seat = 0
	flatterer_target = 0
	fool_owner = 0
	fool_target = 0
	pending_prelate_seat = 0
	deck = list()
	set_aside_hidden = null
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
		return null
	var/card_id = deck[1]
	deck.Cut(1, 2)
	return card_id

/obj/structure/scarlet_seal/proc/draw_card_or_hidden()
	if(length(deck))
		return draw_card()
	if(set_aside_hidden)
		var/card_id = set_aside_hidden
		set_aside_hidden = null
		add_history("The deck is empty — the face-down set-aside card is drawn.")
		return card_id
	return null

/obj/structure/scarlet_seal/proc/must_discard_consort(datum/scarlet_seal_seat/S)
	return (SS_CONSORT in S.hand) && ((SS_HAND in S.hand) || (SS_STEWARD in S.hand))

/obj/structure/scarlet_seal/proc/card_needs_target(card_id)
	return (card_id in list(
		SS_FOOL, SS_WATCHMAN, SS_CONFESSOR, SS_INQUISITOR,
		SS_KNIGHT, SS_SPYMASTER, SS_FLATTERER, SS_STEWARD,
		SS_HAND, SS_MATRIARCH, SS_PRELATE,
	))

/obj/structure/scarlet_seal/proc/card_can_target_self(card_id)
	return (card_id in list(SS_INQUISITOR, SS_FLATTERER, SS_STEWARD))

/obj/structure/scarlet_seal/proc/valid_targets(datum/scarlet_seal_seat/actor, card_id)
	. = list()
	if(!card_needs_target(card_id))
		return
	var/can_self = card_can_target_self(card_id)
	var/list/base = list()
	for(var/datum/scarlet_seal_seat/T as anything in seats)
		if(!T.ckey || T.eliminated)
			continue
		if(T == actor)
			if(can_self)
				base += T.index
		else if(!T.protected)
			base += T.index

	// Enforce Flatterer forced target if active
	if(flatterer_target >= 1 && flatterer_target <= length(seats))
		var/datum/scarlet_seal_seat/F = seats[flatterer_target]
		if(F.ckey && !F.eliminated)
			if(!(flatterer_target in base))
				// Forced player cannot legally be chosen -> card has no effect
				return list()
			if(card_id == SS_INQUISITOR)
				// Needs 2 players including flatterer_target
				if(length(base) < 2)
					return list()
				return base
			if(card_id == SS_SPYMASTER)
				// Needs 1 or 2 players including flatterer_target
				return base
			// Single-target cards must choose flatterer_target exclusively
			return list(flatterer_target)

	if(card_id == SS_INQUISITOR && length(base) < 2)
		return list()
	return base

/obj/structure/scarlet_seal/proc/start_match()
	var/list/datum/scarlet_seal_seat/seated = seated_list()
	if(length(seated) < 2)
		return
	drop_reset()
	expanded_deck = (length(seated) >= 5)
	seals_to_win = target_seals_for(length(seated))
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		S.seals = 0
		S.clear_round()
	round_num = 0
	last_winners = list()
	match_winners = list()
	history = list()
	add_history("A new match begins with the [expanded_deck ? "32-card expanded" : "16-card classic"] deck! First to [seals_to_win] Seals of Favor wins.")
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
	flatterer_target = 0
	fool_owner = 0
	fool_target = 0
	pending_prelate_seat = 0
	set_aside_open = list()
	set_aside_hidden = null
	for(var/datum/scarlet_seal_seat/S as anything in seats)
		S.clear_round()

	deck = build_deck(expanded_deck)
	set_aside_hidden = draw_card()
	if(length(seated) == 2 && !expanded_deck)
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
		for(var/card_id in set_aside_open)
			open_labels += card_label(card_id)
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
	var/had_warden = victim.has_warden()
	victim.eliminated = TRUE
	victim.protected = FALSE
	if(flatterer_target == victim.index)
		flatterer_target = 0
	var/list/dropped = list()
	while(length(victim.hand))
		var/card_id = victim.hand[1]
		victim.hand.Cut(1, 2)
		victim.discards += card_id
		dropped += card_label(card_id)
	if(length(dropped))
		add_history("[victim.name] is knocked out and discards [english_list(dropped)].")
	else
		add_history("[victim.name] is knocked out of the round.")
	playsound(src, SS_SOUND_ELIMINATE, 60, FALSE)
	if(had_warden)
		victim.seals++
		add_history("[victim.name] reveals Warden (6) in their discards and claims a Seal of Favor!")
		playsound(src, SS_SOUND_SEAL, 65, FALSE)

/obj/structure/scarlet_seal/proc/play_card(mob/user, slot, target_idx, target2_idx, peek_idx, guess)
	if(phase != SS_PHASE_PLAYING || pending_prelate_seat)
		return FALSE
	var/datum/scarlet_seal_seat/actor = seat_for(user)
	if(!actor || actor.index != turn_seat || actor.eliminated)
		to_chat(user, span_warning("It is not your turn."))
		return FALSE
	if(!slot || slot < 1 || slot > length(actor.hand))
		return FALSE
	var/card_id = actor.hand[slot]
	if(must_discard_consort(actor) && card_id != SS_CONSORT)
		to_chat(user, span_warning("You must discard the Consort when holding the Hand or Steward."))
		return FALSE

	var/list/targets = valid_targets(actor, card_id)
	var/datum/scarlet_seal_seat/target = null
	var/datum/scarlet_seal_seat/target2 = null
	var/datum/scarlet_seal_seat/peek_seat = null
	var/active_flatterer = flatterer_target

	if(card_needs_target(card_id) && length(targets))
		if(card_id == SS_INQUISITOR)
			if(!(target_idx in targets) || !(target2_idx in targets) || target_idx == target2_idx)
				to_chat(user, span_warning("Choose two distinct valid players to swap hands."))
				return FALSE
			if(active_flatterer && active_flatterer != target_idx && active_flatterer != target2_idx)
				to_chat(user, span_warning("You must include the Flatterer's chosen target."))
				return FALSE
			if(peek_idx != target_idx && peek_idx != target2_idx)
				to_chat(user, span_warning("Choose which of the two swapped hands to inspect."))
				return FALSE
			target = seats[target_idx]
			target2 = seats[target2_idx]
			peek_seat = seats[peek_idx]
		else if(card_id == SS_SPYMASTER)
			if(!(target_idx in targets))
				to_chat(user, span_warning("Choose at least one valid target for Spymaster."))
				return FALSE
			if(target2_idx && (!(target2_idx in targets) || target2_idx == target_idx))
				to_chat(user, span_warning("Choose a second distinct valid target, or only one target."))
				return FALSE
			if(active_flatterer && active_flatterer != target_idx && active_flatterer != target2_idx)
				to_chat(user, span_warning("You must include the Flatterer's chosen target."))
				return FALSE
			target = seats[target_idx]
			if(target2_idx)
				target2 = seats[target2_idx]
		else
			if(!(target_idx in targets))
				to_chat(user, span_warning("Choose a valid target for [card_name(card_id)]."))
				return FALSE
			target = seats[target_idx]

		if(card_id == SS_WATCHMAN && target)
			var/min_guess = expanded_deck ? 0 : 2
			var/max_guess = expanded_deck ? 9 : 8
			if(guess < min_guess || guess > max_guess || guess == 1)
				to_chat(user, span_warning("Name a number other than 1."))
				return FALSE
		if(card_id == SS_PRELATE && target)
			if(guess < 0 || guess > 9)
				to_chat(user, span_warning("Name a number from 0 to 9."))
				return FALSE

	// Discard the chosen card face-up in front of the player
	actor.hand.Cut(slot, slot + 1)
	actor.discards += card_id
	// Flatterer applies only to the next card played; clear before resolving this card
	flatterer_target = 0
	playsound(src, SS_SOUND_PLAY, 55, FALSE)

	switch(card_id)
		if(SS_SOVEREIGN)
			add_history("[actor.name] discards Sovereign (8) — their missive is cast into the hearth!")
			eliminate_seat(actor)

		if(SS_CONSORT)
			add_history("[actor.name] discards Consort (7).")

		if(SS_CUTTHROAT)
			add_history("[actor.name] discards Cutthroat (0).")

		if(SS_SENESCHAL)
			add_history("[actor.name] discards Seneschal (5) (+1 to showdown hand value).")

		if(SS_WARDEN)
			add_history("[actor.name] discards Warden (6) (claims a Seal of Favor if knocked out).")

		if(SS_ATTENDANT)
			actor.protected = TRUE
			add_history("[actor.name] plays Attendant (4) and is shielded from other cards until their next turn.")

		if(SS_FLATTERER)
			flatterer_target = target.index
			var/target_desc = (target == actor) ? "themself" : target.name
			add_history("[actor.name] plays Flatterer (4), marking [target_desc] — the next targeting card must choose [target.name]!")

		if(SS_FOOL)
			if(!target)
				add_history("[actor.name] discards Fool (0) without effect (no valid target).")
			else
				fool_owner = actor.index
				fool_target = target.index
				add_history("[actor.name] plays Fool (0) and places the Fool token on [target.name]!")

		if(SS_WATCHMAN)
			if(!target)
				add_history("[actor.name] discards Watchman (1) without effect (no valid target).")
			else if(length(target.hand) && target.hand[1] == SS_CUTTHROAT)
				add_history("[actor.name] plays Watchman (1) on [target.name], naming [number_label(guess)] — [target.name] reveals Cutthroat (0)! [actor.name] is ambushed!")
				target.hand.Cut(1, 2)
				target.discards += SS_CUTTHROAT
				var/drawn = draw_card_or_hidden()
				if(drawn)
					target.hand += drawn
				add_history("[target.name] discards Cutthroat (0) and draws a new card.")
				eliminate_seat(actor)
			else if(length(target.hand) && card_value(target.hand[1]) == guess)
				add_history("[actor.name] plays Watchman (1) on [target.name], naming [number_label(guess)] — correct!")
				eliminate_seat(target)
			else
				add_history("[actor.name] plays Watchman (1) on [target.name], naming [number_label(guess)] — no match.")

		if(SS_CONFESSOR)
			if(!target)
				add_history("[actor.name] discards Confessor (2) without effect (no valid target).")
			else
				var/seen = length(target.hand) ? target.hand[1] : null
				actor.set_intel("Confessor's Inquiry", "You secretly viewed [target.name]'s hand: [card_label(seen)].", seen ? list(seen) : list())
				add_history("[actor.name] plays Confessor (2) and secretly inspects [target.name]'s hand.")

		if(SS_INQUISITOR)
			if(!target || !target2)
				add_history("[actor.name] discards Inquisitor (2) without effect (fewer than two valid targets).")
			else
				var/card1 = length(target.hand) ? target.hand[1] : null
				var/card2 = length(target2.hand) ? target2.hand[1] : null
				target.hand = card2 ? list(card2) : list()
				target2.hand = card1 ? list(card1) : list()
				if(target != actor)
					target.set_intel("Inquisitor's Decree", "[actor.name] swapped your [card_label(card1)] with [target2.name]'s [card_label(card2)].", card2 ? list(card2) : list())
				if(target2 != actor)
					target2.set_intel("Inquisitor's Decree", "[actor.name] swapped your [card_label(card2)] with [target.name]'s [card_label(card1)].", card1 ? list(card1) : list())
				var/peeked_card = length(peek_seat.hand) ? peek_seat.hand[1] : null
				actor.set_intel("Inquisitor's Inspection", "You swapped [target.name] and [target2.name]'s hands and inspected [peek_seat.name]'s new hand: [card_label(peeked_card)].", peeked_card ? list(peeked_card) : list())
				add_history("[actor.name] plays Inquisitor (2), swapping [target.name] and [target2.name]'s hands and secretly inspecting one.")

		if(SS_KNIGHT)
			if(!target)
				add_history("[actor.name] discards Knight (3) without effect (no valid target).")
			else
				var/my_card = length(actor.hand) ? actor.hand[1] : null
				var/their_card = length(target.hand) ? target.hand[1] : null
				var/my_val = card_value(my_card)
				var/their_val = card_value(their_card)
				if(my_val > their_val)
					actor.set_intel("Knight's Challenge", "Your [card_label(my_card)] beat [target.name]'s [card_label(their_card)].", their_card ? list(their_card) : list())
					target.set_intel("Knight's Challenge", "[actor.name]'s [card_label(my_card)] beat your [card_label(their_card)].", my_card ? list(my_card) : list())
					add_history("[actor.name] plays Knight (3) against [target.name] — [target.name] holds the lower card!")
					eliminate_seat(target)
				else if(their_val > my_val)
					actor.set_intel("Knight's Challenge", "[target.name]'s [card_label(their_card)] beat your [card_label(my_card)].", their_card ? list(their_card) : list())
					target.set_intel("Knight's Challenge", "Your [card_label(their_card)] beat [actor.name]'s [card_label(my_card)].", my_card ? list(my_card) : list())
					add_history("[actor.name] plays Knight (3) against [target.name] — [actor.name] holds the lower card!")
					eliminate_seat(actor)
				else
					actor.set_intel("Knight's Challenge", "You ([card_label(my_card)]) and [target.name] ([card_label(their_card)]) tied!", their_card ? list(their_card) : list())
					target.set_intel("Knight's Challenge", "You ([card_label(their_card)]) and [actor.name] ([card_label(my_card)]) tied!", my_card ? list(my_card) : list())
					add_history("[actor.name] plays Knight (3) against [target.name] — tied hands! Nothing happens.")

		if(SS_SPYMASTER)
			if(!target)
				add_history("[actor.name] discards Spymaster (3) without effect (no valid target).")
			else if(target2)
				var/c1 = length(target.hand) ? target.hand[1] : null
				var/c2 = length(target2.hand) ? target2.hand[1] : null
				var/list/shown = list()
				if(c1)
					shown += c1
				if(c2)
					shown += c2
				actor.set_intel("Spymaster's Report", "You secretly viewed [target.name]'s [card_label(c1)] and [target2.name]'s [card_label(c2)].", shown)
				add_history("[actor.name] plays Spymaster (3) and secretly inspects [target.name] and [target2.name]'s hands.")
			else
				var/c1 = length(target.hand) ? target.hand[1] : null
				actor.set_intel("Spymaster's Report", "You secretly viewed [target.name]'s [card_label(c1)].", c1 ? list(c1) : list())
				add_history("[actor.name] plays Spymaster (3) and secretly inspects [target.name]'s hand.")

		if(SS_STEWARD)
			var/discarded = length(target.hand) ? target.hand[1] : null
			target.hand = list()
			if(discarded)
				target.discards += discarded
			var/target_desc = (target == actor) ? "themself" : target.name
			if(discarded == SS_SOVEREIGN)
				add_history("[actor.name] plays Steward (5) on [target_desc], forcing [target.name] to discard Sovereign (8)!")
				eliminate_seat(target)
			else
				var/drawn = draw_card_or_hidden()
				if(drawn)
					target.hand += drawn
				add_history("[actor.name] plays Steward (5) on [target_desc]. [target.name] discards [card_label(discarded)] and draws a new card.")
				playsound(src, SS_SOUND_DISCARD, 55, FALSE)

		if(SS_HAND)
			if(!target)
				add_history("[actor.name] discards Hand (6) without effect (no valid target).")
			else
				var/my_card = length(actor.hand) ? actor.hand[1] : null
				var/their_card = length(target.hand) ? target.hand[1] : null
				actor.hand = their_card ? list(their_card) : list()
				target.hand = my_card ? list(my_card) : list()
				actor.set_intel("Hand's Decree", "You traded your [card_label(my_card)] to [target.name] and received [card_label(their_card)].", my_card ? list(my_card) : list())
				target.set_intel("Hand's Decree", "[actor.name] traded their [card_label(my_card)] for your [card_label(their_card)].", their_card ? list(their_card) : list())
				add_history("[actor.name] plays Hand (6) and trades hands with [target.name].")

		if(SS_MATRIARCH)
			if(!target)
				add_history("[actor.name] discards Matriarch (7) without effect (no valid target).")
			else
				var/my_card = length(actor.hand) ? actor.hand[1] : null
				var/their_card = length(target.hand) ? target.hand[1] : null
				var/my_val = card_value(my_card)
				var/their_val = card_value(their_card)
				if(my_val < their_val)
					actor.set_intel("Matriarch's Judgment", "Your lower [card_label(my_card)] outlasted [target.name]'s [card_label(their_card)].", their_card ? list(their_card) : list())
					target.set_intel("Matriarch's Judgment", "Your higher [card_label(their_card)] was knocked out against [actor.name]'s [card_label(my_card)].", my_card ? list(my_card) : list())
					add_history("[actor.name] plays Matriarch (7) against [target.name] — [target.name] holds the higher card!")
					eliminate_seat(target)
				else if(their_val < my_val)
					actor.set_intel("Matriarch's Judgment", "Your higher [card_label(my_card)] was knocked out against [target.name]'s [card_label(their_card)].", their_card ? list(their_card) : list())
					target.set_intel("Matriarch's Judgment", "Your lower [card_label(their_card)] outlasted [actor.name]'s [card_label(my_card)].", my_card ? list(my_card) : list())
					add_history("[actor.name] plays Matriarch (7) against [target.name] — [actor.name] holds the higher card!")
					eliminate_seat(actor)
				else
					actor.set_intel("Matriarch's Judgment", "You ([card_label(my_card)]) and [target.name] ([card_label(their_card)]) tied!", their_card ? list(their_card) : list())
					target.set_intel("Matriarch's Judgment", "You ([card_label(their_card)]) and [actor.name] ([card_label(my_card)]) tied!", my_card ? list(my_card) : list())
					add_history("[actor.name] plays Matriarch (7) against [target.name] — tied hands! Nothing happens.")

		if(SS_PRELATE)
			if(!target)
				add_history("[actor.name] discards Prelate (9) without effect (no valid target).")
			else if(length(target.hand) && card_value(target.hand[1]) == guess)
				actor.seals++
				add_history("[actor.name] plays Prelate (9) on [target.name], naming [number_label(guess)] — correct! [actor.name] claims a Seal of Favor!")
				playsound(src, SS_SOUND_SEAL, 65, FALSE)
				if(actor.seals >= seals_to_win)
					finish_match_winner(actor)
					return TRUE
				// Target may choose to keep or discard & draw a new card
				pending_prelate_seat = target.index
				message = "[target.name] may keep or redraw their exposed card."
				return TRUE
			else
				add_history("[actor.name] plays Prelate (9) on [target.name], naming [number_label(guess)] — no match.")

	advance_or_end_round()
	return TRUE

/obj/structure/scarlet_seal/proc/handle_prelate_choice(mob/user, choice)
	if(phase != SS_PHASE_PLAYING || !pending_prelate_seat)
		return FALSE
	var/datum/scarlet_seal_seat/S = seat_for(user)
	if(!S || S.index != pending_prelate_seat)
		to_chat(user, span_warning("It is not your decision to make."))
		return FALSE
	if(choice != "keep" && choice != "redraw")
		return FALSE
	pending_prelate_seat = 0
	if(choice == "keep")
		add_history("[S.name] keeps their exposed card.")
		playsound(src, SS_SOUND_NOTIFY, 50, FALSE)
	else
		var/discarded = length(S.hand) ? S.hand[1] : null
		S.hand = list()
		if(discarded)
			S.discards += discarded
		if(discarded == SS_SOVEREIGN)
			add_history("[S.name] chooses to discard Sovereign (8) — their missive is cast into the hearth!")
			eliminate_seat(S)
		else
			var/drawn = draw_card_or_hidden()
			if(drawn)
				S.hand += drawn
			add_history("[S.name] discards [card_label(discarded)] and draws a new card.")
			playsound(src, SS_SOUND_DISCARD, 55, FALSE)
	advance_or_end_round()
	return TRUE

/obj/structure/scarlet_seal/proc/advance_or_end_round()
	var/list/datum/scarlet_seal_seat/alive = active_list()
	if(length(alive) <= 1)
		finish_round(alive, FALSE)
		return

	if(!length(deck))
		var/has_sovereign = FALSE
		for(var/datum/scarlet_seal_seat/S as anything in alive)
			if(length(S.hand) && S.hand[1] == SS_SOVEREIGN)
				has_sovereign = TRUE
				break

		var/best_val = -1
		var/list/datum/scarlet_seal_seat/tied = list()
		for(var/datum/scarlet_seal_seat/S as anything in alive)
			var/card_id = length(S.hand) ? S.hand[1] : null
			// Sovereign always beats Prelate at end-of-round showdown
			if(has_sovereign && card_id == SS_PRELATE)
				continue
			var/eff_val = card_value(card_id) + S.seneschal_count()
			if(eff_val > best_val)
				best_val = eff_val
				tied = list(S)
			else if(eff_val == best_val)
				tied += S

		var/list/datum/scarlet_seal_seat/winners = tied
		if(length(tied) > 1)
			var/best_discard = -1
			winners = list()
			for(var/datum/scarlet_seal_seat/S as anything in tied)
				var/dsum = seat_discard_sum(S)
				if(dsum > best_discard)
					best_discard = dsum
					winners = list(S)
				else if(dsum == best_discard)
					winners += S
		finish_round(winners, TRUE)
		return

	// Mid-round immediate victory check (e.g. Warden triggered on elimination while round continues)
	var/list/datum/scarlet_seal_seat/mid_leaders = top_match_leaders()
	if(length(mid_leaders) == 1)
		finish_match_winner(mid_leaders[1])
		return

	for(var/offset in 1 to SS_MAX_SEATS)
		var/next_idx = ((turn_seat - 1 + offset) % SS_MAX_SEATS) + 1
		var/datum/scarlet_seal_seat/candidate = seats[next_idx]
		if(candidate.ckey && !candidate.eliminated)
			turn_seat = next_idx
			begin_turn(candidate)
			return

/obj/structure/scarlet_seal/proc/top_match_leaders()
	var/top_seals = 0
	var/list/datum/scarlet_seal_seat/leaders = list()
	for(var/datum/scarlet_seal_seat/S as anything in seated_list())
		if(S.seals >= seals_to_win)
			if(S.seals > top_seals)
				top_seals = S.seals
				leaders = list(S)
			else if(S.seals == top_seals)
				leaders += S
	return leaders

/obj/structure/scarlet_seal/proc/finish_match_winner(datum/scarlet_seal_seat/champ)
	phase = SS_PHASE_MATCH_END
	turn_seat = 0
	pending_prelate_seat = 0
	flatterer_target = 0
	match_winners = list(champ.index)
	message = "[champ.name] wins the match with [champ.seals] Seals of Favor!"
	add_history(message)
	play_match_end_sounds(champ.ckey)
	update_icon()

/obj/structure/scarlet_seal/proc/finish_round(list/datum/scarlet_seal_seat/winners, is_showdown)
	showdown = is_showdown
	turn_seat = 0
	pending_prelate_seat = 0
	flatterer_target = 0
	last_winners = list()
	var/list/win_names = list()
	for(var/datum/scarlet_seal_seat/W as anything in winners)
		W.seals++
		last_winners += W.index
		win_names += W.name

	if(is_showdown)
		var/list/reveal_parts = list()
		for(var/datum/scarlet_seal_seat/S as anything in active_list())
			var/card_id = length(S.hand) ? S.hand[1] : null
			var/bonus = S.seneschal_count()
			var/bonus_str = bonus ? " +[bonus] Seneschal" : ""
			reveal_parts += "[S.name]: [card_label(card_id)][bonus_str] (discards [seat_discard_sum(S)])"
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

	// Resolve Fool bet if the marked player won the round
	if(fool_owner >= 1 && fool_owner <= length(seats) && fool_target && (fool_target in last_winners))
		var/datum/scarlet_seal_seat/FO = seats[fool_owner]
		var/datum/scarlet_seal_seat/FT = seats[fool_target]
		if(FO.ckey)
			FO.seals++
			add_history("[FO.name]'s Fool bet on [FT.name] pays off — [FO.name] claims a Seal of Favor!")

	var/list/datum/scarlet_seal_seat/leaders = top_match_leaders()
	if(length(leaders) == 1)
		finish_match_winner(leaders[1])
	else if(length(leaders) > 1)
		phase = SS_PHASE_ROUND_END
		var/list/tied_names = list()
		for(var/datum/scarlet_seal_seat/L as anything in leaders)
			tied_names += L.name
		message = "[english_list(tied_names)] are tied at [leaders[1].seals] Seals of Favor — deal a tiebreaker round!"
		add_history(message)
		playsound(src, SS_SOUND_SEAL, 65, FALSE)
		update_icon()
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
			pending_prelate_seat = 0
			flatterer_target = 0
			match_winners = list(survivor.index)
			message = "[survivor.name] wins by forfeit."
			add_history(message)
			play_match_end_sounds(survivor.ckey)
		else
			phase = SS_PHASE_LOBBY
			turn_seat = 0
			pending_prelate_seat = 0
			flatterer_target = 0
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

#undef SS_FOOL
#undef SS_CUTTHROAT
#undef SS_WATCHMAN
#undef SS_CONFESSOR
#undef SS_INQUISITOR
#undef SS_KNIGHT
#undef SS_SPYMASTER
#undef SS_ATTENDANT
#undef SS_FLATTERER
#undef SS_STEWARD
#undef SS_SENESCHAL
#undef SS_HAND
#undef SS_WARDEN
#undef SS_CONSORT
#undef SS_MATRIARCH
#undef SS_SOVEREIGN
#undef SS_PRELATE
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
