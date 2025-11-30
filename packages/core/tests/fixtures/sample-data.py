def find_max(numbers):
    if not numbers:
        return None
    return max(numbers)

def find_min(numbers):
    if not numbers:
        return None
    return min(numbers)

class DataProcessor:
    def __init__(self, data):
        self.data = data

    def filter_positive(self):
        return [x for x in self.data if x > 0]

    def filter_negative(self):
        return [x for x in self.data if x < 0]

    def sum_all(self):
        return sum(self.data)

    def average(self):
        if not self.data:
            return 0
        return sum(self.data) / len(self.data)
