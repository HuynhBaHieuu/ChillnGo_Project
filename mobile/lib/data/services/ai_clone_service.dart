/// AI clone (server/src/routes/aiClone.ts; web/src/services/aiClone.service.ts):
/// adapt a journey to your trip, review what the AI changed, chat to edit,
/// then save it to "Đã sao chép". Only journeys the API stores can be adapted:
/// the AI may only use what ChillnGo's database holds.
library;

import '../api.dart';
import '../json.dart';
import '../models.dart';
import '../server_posts.dart';

int? _intOrNull(Object? v) => v is num ? v.round() : null;
double? _numOrNull(Object? v) => v is num ? v.toDouble() : null;
bool? _boolOrNull(Object? v) => v is bool ? v : null;

/// The form sent to the AI (server/src/ai/schemas.ts).
class AiCloneForm {
  const AiCloneForm({
    required this.startDate,
    required this.days,
    this.groupSize = 2,
    this.withChildren = false,
    this.withElderly = false,
    this.budget,
    this.departure = '',
    this.interests = const [],
    this.pace = 'moderate',
  });

  final String startDate;
  final int days;
  final int groupSize;
  final bool withChildren;
  final bool withElderly;

  /// Whole trip, whole group, VND. Null: no budget.
  final int? budget;
  final String departure;
  final List<String> interests;

  /// 'relaxed' | 'moderate' | 'packed'
  final String pace;

  /// The defaults with what the chat has gathered on top ([answers] as read by parseTripReply).
  factory AiCloneForm.from(Map<String, Object?> answers, {required String startDate, required int days}) => AiCloneForm(
    startDate: answers['startDate'] as String? ?? startDate,
    days: answers['days'] as int? ?? days,
    groupSize: answers['groupSize'] as int? ?? 2,
    withChildren: answers['withChildren'] as bool? ?? false,
    withElderly: answers['withElderly'] as bool? ?? false,
    budget: answers['budget'] as int?,
    departure: answers['departure'] as String? ?? '',
    interests: answers['interests'] as List<String>? ?? const [],
    pace: answers['pace'] as String? ?? 'moderate',
  );

  factory AiCloneForm.fromJson(Json j) => AiCloneForm(
    startDate: str(j['startDate']),
    days: intOf(j['days'], 1),
    groupSize: intOf(j['groupSize'], 1),
    withChildren: boolOf(j['withChildren']),
    withElderly: boolOf(j['withElderly']),
    budget: _intOrNull(j['budget']),
    departure: str(j['departure']),
    interests: stringList(j['interests']),
    pace: str(j['pace'], 'moderate'),
  );

  Json toJson() => {
    'startDate': startDate,
    'days': days,
    'groupSize': groupSize,
    'withChildren': withChildren,
    'withElderly': withElderly,
    'budget': budget,
    'departure': departure,
    'interests': interests,
    'pace': pace,
  };
}

/// The form's options for a journey: destination, interests, season, journeys to merge, AI requests left.
class AiCloneOptions {
  AiCloneOptions(Json j)
    : destination = strOrNull(j['destination']),
      interests = listOf(j['interests'], (i) => (value: str(mapOf(i)['value']), label: str(mapOf(i)['label']))),
      rainyMonths = listOf(mapOf(j['season'])['rainyMonths'], intOf),
      peakMonths = listOf(mapOf(j['season'])['peakMonths'], intOf),
      festivals = listOf(mapOf(j['season'])['festivals'], (f) => (name: str(mapOf(f)['name']), month: intOf(mapOf(f)['month']))),
      mergeable = listOf(
        j['mergeable'],
        (m) => (postId: str(mapOf(m)['postId']), title: str(mapOf(m)['title']), days: intOf(mapOf(m)['days']), author: strOrNull(mapOf(m)['author'])),
      ),
      callsLeft = intOf(j['callsLeft']),
      dailyLimit = intOf(j['dailyLimit']);

  /// Null when ChillnGo has no place data for where this journey goes.
  final String? destination;
  final List<({String value, String label})> interests;
  final List<int> rainyMonths;
  final List<int> peakMonths;
  final List<({String name, int month})> festivals;
  final List<({String postId, String title, int days, String? author})> mergeable;
  final int callsLeft;
  final int dailyLimit;
}

/// A place as ChillnGo's data knows it. Null fields: no data.
class AiPlace {
  AiPlace(Json j)
    : name = str(j['name']),
      address = str(j['address']),
      lat = _numOrNull(j['lat']),
      lng = _numOrNull(j['lng']),
      category = strOrNull(j['category']),
      avgCost = _intOrNull(j['avgCost']),
      opens = strOrNull(mapOrNull(j['openingHours'])?['open']),
      closes = strOrNull(mapOrNull(j['openingHours'])?['close']),
      isOutdoor = _boolOrNull(j['isOutdoor']),
      requiresBooking = _boolOrNull(j['requiresBooking']),
      rating = _numOrNull(j['rating']),
      photoUrl = strOrNull(j['photoUrl']),
      cost = _intOrNull(j['cost']),
      costBasis = strOrNull(j['costBasis']);

  final String name;
  final String address;
  final double? lat;
  final double? lng;
  final String? category;
  final int? avgCost;
  final String? opens;
  final String? closes;
  final bool? isOutdoor;
  final bool? requiresBooking;
  final double? rating;
  final String? photoUrl;

  /// For the whole group, VND.
  final int? cost;

  /// 'perPerson': average per person × group; 'author': as the original journey's author wrote it.
  final String? costBasis;
}

/// One change of the draft: a stop kept, replaced, added, or (in notInPlan) removed.
class AiChange {
  AiChange(Json j)
    : id = str(j['changeId']),
      type = str(j['type'], 'keep'),
      status = str(j['status'], 'pending'),
      startTime = str(j['startTime']),
      endTime = str(j['endTime']),
      reason = str(j['reason']),
      place = AiPlace(mapOf(j['place'])),
      original = mapOrNull(j['original']) == null ? null : AiPlace(mapOf(j['original'])),
      planB = mapOrNull(j['planB']) == null ? null : (name: str(mapOf(mapOf(j['planB'])['place'])['name']), reason: str(mapOf(j['planB'])['reason']));

  final String id;

  /// 'keep' | 'replace' | 'add' | 'remove'
  final String type;

  /// 'pending' | 'accepted' | 'reverted'
  final String status;
  final String startTime;
  final String endTime;
  final String reason;
  final AiPlace place;

  /// For a replace: the stop it replaces.
  final AiPlace? original;

  /// The nearest place of the same kind that is free and open then.
  final ({String name, String reason})? planB;
}

class AiDraft {
  AiDraft(Json j)
    : id = str(j['_id']),
      sources = listOf(j['sources'], (s) {
        final m = mapOf(s);
        return (postId: str(m['postId']), title: str(m['title']), author: strOrNull(mapOrNull(m['author'])?['username']));
      }),
      destination = strOrNull(j['destination']),
      form = AiCloneForm.fromJson(mapOf(j['formInput'])),
      days = listOf(j['days'], (d) {
        final m = mapOf(d);
        return (
          dayIndex: intOf(m['dayIndex'], 1),
          date: str(m['date']),
          cost: intOf(mapOf(m['cost'])['total']),
          missing: intOf(mapOf(m['cost'])['missing']),
          stops: listOf(m['stops'], (s) => AiChange(mapOf(s))),
        );
      }),
      notInPlan = listOf(j['notInPlan'], (c) => AiChange(mapOf(c))),
      cost = intOf(mapOf(j['cost'])['total']),
      costMissing = intOf(mapOf(j['cost'])['missing']),
      budget = _intOrNull(mapOf(j['cost'])['budget']),
      overBudget = boolOf(mapOf(j['cost'])['overBudget']),
      warnings = stringList(j['warnings']),
      rainy = boolOf(mapOf(j['season'])['rainy']),
      peak = boolOf(mapOf(j['season'])['peak']),
      festivals = listOf(mapOf(j['season'])['festivals'], (f) => (name: str(mapOf(f)['name']), month: intOf(mapOf(f)['month']))),
      checklist = Checklist.fromJson(j['checklist']),
      pendingCount = intOf(j['pendingCount']),
      chat = listOf(j['chat'], (m) => (mine: str(mapOf(m)['role']) == 'user', text: str(mapOf(m)['content']))),
      committedItineraryId = strOrNull(j['committedItineraryId']),
      expiresAt = str(j['expiresAt']),
      callsLeft = intOf(j['callsLeft']),
      dailyLimit = intOf(j['dailyLimit']);

  final String id;
  final List<({String postId, String title, String? author})> sources;
  final String? destination;
  final AiCloneForm form;
  final List<({int dayIndex, String date, int cost, int missing, List<AiChange> stops})> days;

  /// Stops the AI took out, and additions you turned down.
  final List<AiChange> notInPlan;
  final int cost;
  final int costMissing;
  final int? budget;
  final bool overBudget;
  final List<String> warnings;
  final bool rainy;
  final bool peak;
  final List<({String name, int month})> festivals;
  final Checklist? checklist;
  final int pendingCount;
  final List<({bool mine, String text})> chat;

  /// Set once saved to "Đã sao chép".
  final String? committedItineraryId;
  final String expiresAt;
  final int callsLeft;
  final int dailyLimit;

  /// The draft's stops as journey days, for the map. Stops with no position stay off it.
  List<TripDay> get mapDays => [
    for (final d in days)
      TripDay(
        id: 'd${d.dayIndex}',
        dayNumber: d.dayIndex,
        date: d.date,
        locations: [
          for (final s in d.stops)
            if (s.place.lat != null && s.place.lng != null)
              TripLocation(id: s.id, name: s.place.name, estCost: s.place.cost ?? 0, photoUrl: s.place.photoUrl, lat: s.place.lat!, lng: s.place.lng!),
        ],
      ),
  ];
}

AiDraft _draft(Json data) => AiDraft(mapOf(data['draft']));

/// Making a plan takes the AI up to a minute or more.
const _aiTimeout = Duration(minutes: 2);

abstract final class AiCloneService {
  static bool canAiClone(String postId) => isServerId(postId);

  static Future<AiCloneOptions> getOptions(String postId) async => AiCloneOptions(await Api.get('/api/posts/$postId/ai-clone'));

  /// Uses one of today's AI requests. With [mergeWith], an AI merge of this journey and those.
  static Future<AiDraft> create(String postId, AiCloneForm form, {List<String> mergeWith = const []}) async => _draft(
    mergeWith.isEmpty
        ? await Api.post('/api/posts/$postId/ai-clone', body: form.toJson(), timeout: _aiTimeout)
        : await Api.post('/api/posts/ai-merge', body: {'sourceIds': [postId, ...mergeWith], 'form': form.toJson()}, timeout: _aiTimeout),
  );

  static Future<AiDraft> get(String id) async => _draft(await Api.get('/api/ai-drafts/$id'));

  /// Uses one of today's AI requests.
  static Future<AiDraft> chat(String id, String message) async =>
      _draft(await Api.post('/api/ai-drafts/$id/chat', body: {'message': message}, timeout: _aiTimeout));

  /// 'accepted', 'reverted', or back to 'pending'.
  static Future<AiDraft> setStatus(String id, String changeId, String status) async =>
      _draft(await Api.patch('/api/ai-drafts/$id/changes/$changeId', body: {'status': status}));

  static Future<AiDraft> acceptAll(String id) async => _draft(await Api.post('/api/ai-drafts/$id/accept-all'));

  /// One day's stops in the shortest order; no AI involved.
  static Future<({AiDraft draft, double beforeKm, double afterKm, bool changed})> optimizeRoute(String id, int dayIndex) async {
    final data = await Api.post('/api/ai-drafts/$id/optimize-route', body: {'dayIndex': dayIndex});
    final route = mapOf(listOf(data['routes'], (r) => r).firstOrNull);
    return (draft: _draft(data), beforeKm: doubleOf(route['beforeKm']), afterKm: doubleOf(route['afterKm']), changed: boolOf(route['changed']));
  }

  /// The AI orders it when a request is left.
  static Future<AiDraft> checklist(String id) async => _draft(await Api.post('/api/ai-drafts/$id/checklist', timeout: _aiTimeout));

  /// Saves it to "Đã sao chép". Saving twice gives the same itinerary.
  static Future<String> commit(String id) async => str(mapOf((await Api.post('/api/ai-drafts/$id/commit'))['itinerary'])['_id']);
}
