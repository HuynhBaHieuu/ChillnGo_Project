// The same checks as web/src/features/ai-clone/chatParse.test.ts.
import 'package:chillngo/core/assistant_reply.dart';
import 'package:chillngo/core/trip_chat.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final today = DateTime.utc(2026, 10, 27); // a Tuesday
  const interests = [(value: 'food', label: 'Ẩm thực'), (value: 'cafe', label: 'Cà phê')];

  void check(String text, Slot? asking, Map<String, Object?> expected) =>
      expect(parseTripReply(text, asking, interests, today), expected, reason: '"$text" ($asking)');

  test('parseTripReply', () {
    check('3 ngày, 4 người có trẻ em, 5 triệu, từ Hà Nội', null, {'days': 3, 'groupSize': 4, 'withChildren': true, 'budget': 5000000, 'departure': 'Hà Nội'});
    check('đi 3n2đ thong thả', null, {'days': 3, 'pace': 'relaxed'});
    check('2 người, không có trẻ em', null, {'groupSize': 2, 'withChildren': false});
    check('20/11', Slot.date, {'startDate': '2026-11-20'});
    check('1/3', Slot.date, {'startDate': '2027-03-01'}); // already past this year
    check('31/02', Slot.date, {});
    check('cuối tuần này', Slot.date, {'startDate': thisWeekend(today)});
    check('khởi hành 20/11 ngân sách 5.000.000', null, {'startDate': '2026-11-20', 'budget': 5000000});
    check('500k', Slot.budget, {'budget': 500000});
    check('1,5 triệu', Slot.budget, {'budget': 1500000});
    check('5', Slot.budget, {'budget': 5000000});
    check('không giới hạn', Slot.budget, {'budget': null});
    check('4', Slot.days, {'days': 4});
    check('20', Slot.days, {}); // over 14: asked again
    check('4', Slot.group, {'groupSize': 4});
    check('một mình', Slot.group, {'groupSize': 1});
    check('đi cùng ông bà', Slot.group, {'withElderly': true});
    check('Đà Nẵng', Slot.departure, {'departure': 'Đà Nẵng'});
    check('bỏ qua', Slot.departure, {});
    check('đi từ 20/11, 2 ngày', null, {'startDate': '2026-11-20', 'days': 2});
    check('ẩm thực và cà phê', Slot.interests, {'interests': ['food', 'cafe']});
    check('tất cả', Slot.interests, {'interests': <String>[]});
    check('vừa', Slot.pace, {'pace': 'moderate'});
    check('3 days for 2 people with kids', null, {'days': 3, 'groupSize': 2, 'withChildren': true});
    expect(thisWeekend(today), '2026-10-31');
  });

  test('parseAssistantReply', () {
    const id = '65f0c0ffee0123456789abcd';
    final reply = parseAssistantReply('<<g:explain>> Thử **Huế 3N2Đ** <<j:$id>> nhé.\n* Ngày 1 <<g:stress>>chợ\n<<g:thum');
    expect(reply.text, 'Thử Huế 3N2Đ nhé.\n• Ngày 1 chợ\n');
    expect(reply.links, [(at: 'Thử Huế 3N2Đ'.length, id: id)]);
  });
}
